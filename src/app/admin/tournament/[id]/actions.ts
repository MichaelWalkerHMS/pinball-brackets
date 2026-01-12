"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recalculateScores } from "@/lib/scoring";

/**
 * Verify the current user is an admin.
 */
async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: "Not authorized" };
  }

  return { user };
}

/**
 * Bulk import players for a tournament.
 * Replaces all existing players with the new list.
 */
export async function bulkImportPlayers(
  tournamentId: string,
  names: string[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Verify tournament exists
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, player_count")
    .eq("id", tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return { error: "Tournament not found" };
  }

  // Validate player count
  if (names.length > tournament.player_count) {
    return {
      error: `Too many players. Maximum is ${tournament.player_count}.`,
    };
  }

  // Check if there are existing brackets - if so, we need to log the seeding change
  const { count: bracketCount } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  // Get existing players BEFORE deleting (to compare for change detection)
  const { data: existingPlayers } = await supabase
    .from("players")
    .select("seed, name")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true });

  // Build a map of existing seed -> name for comparison
  const existingNamesBySeed = new Map<number, string>();
  if (existingPlayers) {
    for (const p of existingPlayers) {
      existingNamesBySeed.set(p.seed, p.name);
    }
  }

  // Delete existing players
  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .eq("tournament_id", tournamentId);

  if (deleteError) {
    console.error("Error deleting existing players:", deleteError);
    return { error: "Failed to clear existing players" };
  }

  // Insert new players
  const playersToInsert = names.map((name, index) => ({
    tournament_id: tournamentId,
    name: name.trim(),
    seed: index + 1,
  }));

  const { error: insertError } = await supabase
    .from("players")
    .insert(playersToInsert);

  if (insertError) {
    console.error("Error inserting players:", insertError);
    return { error: "Failed to insert players" };
  }

  // Log seeding change if brackets exist AND something actually changed
  if (bracketCount && bracketCount > 0) {
    // Only log seeds where the name actually changed
    const affectedSeeds: number[] = [];
    for (let i = 0; i < names.length; i++) {
      const seed = i + 1;
      const newName = names[i].trim();
      const oldName = existingNamesBySeed.get(seed);
      if (oldName !== newName) {
        affectedSeeds.push(seed);
      }
    }
    // Also check for seeds that were removed (existed before but not now)
    for (const oldSeed of existingNamesBySeed.keys()) {
      if (oldSeed > names.length && !affectedSeeds.includes(oldSeed)) {
        affectedSeeds.push(oldSeed);
      }
    }

    // Only log if something actually changed
    if (affectedSeeds.length > 0) {
      await supabase.from("seeding_change_log").insert({
        tournament_id: tournamentId,
        changed_by: auth.user.id,
        change_type: "bulk_import",
        affected_seeds: affectedSeeds,
        description: `Bulk imported ${names.length} players (${affectedSeeds.length} changed)`,
      });
    }
  }

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true, count: names.length };
}

/**
 * Update a single player's name
 */
export async function updatePlayerName(playerId: string, name: string) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Get the player to find tournament ID
  const { data: player, error: fetchError } = await supabase
    .from("players")
    .select("tournament_id, name, seed")
    .eq("id", playerId)
    .single();

  if (fetchError || !player) {
    return { error: "Player not found" };
  }

  const oldName = player.name;

  // Update player name
  const { error: updateError } = await supabase
    .from("players")
    .update({ name: name.trim() })
    .eq("id", playerId);

  if (updateError) {
    console.error("Error updating player name:", updateError);
    return { error: "Failed to update player name" };
  }

  // Log seeding change
  await supabase.from("seeding_change_log").insert({
    tournament_id: player.tournament_id,
    changed_by: auth.user.id,
    change_type: "rename",
    affected_seeds: [player.seed],
    description: `Renamed seed ${player.seed}: "${oldName}" → "${name.trim()}"`,
  });

  revalidatePath(`/admin/tournament/${player.tournament_id}`);
  return { success: true };
}

/**
 * Delete a player and shift seeds below up
 */
export async function deletePlayer(playerId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Get the player to find tournament ID and seed
  const { data: player, error: fetchError } = await supabase
    .from("players")
    .select("tournament_id, name, seed")
    .eq("id", playerId)
    .single();

  if (fetchError || !player) {
    return { error: "Player not found" };
  }

  const deletedSeed = player.seed;
  const tournamentId = player.tournament_id;

  // Get all players with higher seeds
  const { data: higherPlayers } = await supabase
    .from("players")
    .select("id, seed")
    .eq("tournament_id", tournamentId)
    .gt("seed", deletedSeed)
    .order("seed", { ascending: true });

  // Delete the player
  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId);

  if (deleteError) {
    console.error("Error deleting player:", deleteError);
    return { error: "Failed to delete player" };
  }

  // Shift seeds up for all players below
  if (higherPlayers && higherPlayers.length > 0) {
    for (const p of higherPlayers) {
      await supabase
        .from("players")
        .update({ seed: p.seed - 1 })
        .eq("id", p.id);
    }
  }

  // Calculate affected seeds (deleted seed and all below)
  const affectedSeeds = [deletedSeed];
  if (higherPlayers) {
    affectedSeeds.push(...higherPlayers.map((p) => p.seed));
  }

  // Log seeding change
  await supabase.from("seeding_change_log").insert({
    tournament_id: tournamentId,
    changed_by: auth.user.id,
    change_type: "delete",
    affected_seeds: affectedSeeds,
    description: `Deleted "${player.name}" (was seed ${deletedSeed}). Seeds ${deletedSeed + 1}+ shifted up.`,
  });

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Add a new player at a specific seed position
 */
export async function addPlayer(
  tournamentId: string,
  name: string,
  seed: number
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Verify tournament exists and check player count
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("player_count")
    .eq("id", tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return { error: "Tournament not found" };
  }

  // Get current player count
  const { count: currentCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  if (currentCount && currentCount >= tournament.player_count) {
    return { error: "Tournament is already at maximum player capacity" };
  }

  // Shift seeds down for all players at or below the new seed position
  const { data: playersToShift } = await supabase
    .from("players")
    .select("id, seed")
    .eq("tournament_id", tournamentId)
    .gte("seed", seed)
    .order("seed", { ascending: false }); // Start from highest to avoid conflicts

  if (playersToShift && playersToShift.length > 0) {
    for (const p of playersToShift) {
      await supabase
        .from("players")
        .update({ seed: p.seed + 1 })
        .eq("id", p.id);
    }
  }

  // Insert new player
  const { error: insertError } = await supabase.from("players").insert({
    tournament_id: tournamentId,
    name: name.trim(),
    seed,
  });

  if (insertError) {
    console.error("Error inserting player:", insertError);
    return { error: "Failed to add player" };
  }

  // Calculate affected seeds
  const affectedSeeds = [seed];
  if (playersToShift) {
    affectedSeeds.push(...playersToShift.map((p) => p.seed + 1));
  }

  // Log seeding change
  await supabase.from("seeding_change_log").insert({
    tournament_id: tournamentId,
    changed_by: auth.user.id,
    change_type: "add",
    affected_seeds: affectedSeeds,
    description: `Added "${name.trim()}" at seed ${seed}. Seeds ${seed}+ shifted down.`,
  });

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Reorder players by providing the new order
 */
export async function reorderPlayers(
  tournamentId: string,
  newOrder: Array<{ id: string; seed: number }>
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Get current order to determine affected seeds
  const { data: currentPlayers } = await supabase
    .from("players")
    .select("id, seed, name")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true });

  if (!currentPlayers) {
    return { error: "Failed to fetch current players" };
  }

  // Find which seeds changed
  const affectedSeeds: number[] = [];
  for (const newPlayer of newOrder) {
    const current = currentPlayers.find((p) => p.id === newPlayer.id);
    if (current && current.seed !== newPlayer.seed) {
      affectedSeeds.push(current.seed, newPlayer.seed);
    }
  }

  // Remove duplicates
  const uniqueAffectedSeeds = [...new Set(affectedSeeds)].sort((a, b) => a - b);

  if (uniqueAffectedSeeds.length === 0) {
    return { success: true }; // No changes
  }

  // Delete all players and re-insert with new order
  // (This avoids unique constraint issues during reordering)
  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .eq("tournament_id", tournamentId);

  if (deleteError) {
    console.error("Error deleting players for reorder:", deleteError);
    return { error: "Failed to reorder players" };
  }

  // Build new player list maintaining names
  const playerMap = new Map(currentPlayers.map((p) => [p.id, p]));
  const playersToInsert = newOrder.map((item) => {
    const player = playerMap.get(item.id);
    return {
      tournament_id: tournamentId,
      name: player?.name || "Unknown",
      seed: item.seed,
    };
  });

  const { error: insertError } = await supabase
    .from("players")
    .insert(playersToInsert);

  if (insertError) {
    console.error("Error inserting reordered players:", insertError);
    return { error: "Failed to save new player order" };
  }

  // Log seeding change
  await supabase.from("seeding_change_log").insert({
    tournament_id: tournamentId,
    changed_by: auth.user.id,
    change_type: "reorder",
    affected_seeds: uniqueAffectedSeeds,
    description: `Reordered players. Seeds affected: ${uniqueAffectedSeeds.join(", ")}`,
  });

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Save a match result
 */
export async function saveResult(
  tournamentId: string,
  round: number,
  matchPosition: number,
  winnerSeed: number,
  loserSeed: number,
  winnerGames?: number,
  loserGames?: number
) {
  // Validate game counts (best-of-7 format: first to 4 wins)
  if (winnerGames !== undefined && winnerGames > 4) {
    return { error: "Winner games cannot exceed 4" };
  }
  if (loserGames !== undefined && loserGames > 3) {
    return { error: "Loser games cannot exceed 3" };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Upsert the result (insert or update if exists)
  const { error } = await supabase.from("results").upsert(
    {
      tournament_id: tournamentId,
      round,
      match_position: matchPosition,
      winner_seed: winnerSeed,
      loser_seed: loserSeed,
      winner_games: winnerGames,
      loser_games: loserGames,
    },
    {
      onConflict: "tournament_id,round,match_position",
    }
  );

  if (error) {
    console.error("Error saving result:", error);
    return { error: "Failed to save result" };
  }

  // Recalculate scores for all brackets in this tournament
  await recalculateScores(tournamentId);

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Delete a match result
 */
export async function deleteResult(
  tournamentId: string,
  round: number,
  matchPosition: number
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("results")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("round", round)
    .eq("match_position", matchPosition);

  if (error) {
    console.error("Error deleting result:", error);
    return { error: "Failed to delete result" };
  }

  // Recalculate scores for all brackets in this tournament
  await recalculateScores(tournamentId);

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Clear all results for rounds after a specific round
 * (Used when changing an earlier result that invalidates later rounds)
 */
export async function clearDownstreamResults(
  tournamentId: string,
  fromRound: number
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("results")
    .delete()
    .eq("tournament_id", tournamentId)
    .gt("round", fromRound);

  if (error) {
    console.error("Error clearing downstream results:", error);
    return { error: "Failed to clear downstream results" };
  }

  // Recalculate scores for all brackets in this tournament
  await recalculateScores(tournamentId);

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true };
}

/**
 * Manually recalculate all bracket scores for a tournament
 * (Emergency recovery function for admins)
 */
export async function manualRecalculateScores(tournamentId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const result = await recalculateScores(tournamentId);

  if (!result.success) {
    return { error: result.error || "Failed to recalculate scores" };
  }

  revalidatePath(`/admin/tournament/${tournamentId}`);
  revalidatePath(`/tournament/${tournamentId}`);
  return { success: true, count: result.count };
}

/**
 * Import players from Match Play Events
 * Replaces all existing players with the Match Play data
 * Re-validates against Match Play API to prevent data tampering
 */
export async function importMatchPlayPlayers(
  tournamentId: string,
  players: Array<{
    name: string;
    seed: number;
    matchplay_id: string;
    ifpa_id: number | null;
  }>
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Verify tournament exists and has a matchplay_id
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, player_count, matchplay_id")
    .eq("id", tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return { error: "Tournament not found" };
  }

  if (!tournament.matchplay_id) {
    return { error: "Tournament does not have a Match Play ID configured" };
  }

  // Server-side validation: Re-fetch players from Match Play to prevent data tampering
  const { createMatchPlayClient, mapMatchPlayPlayers } = await import("@/lib/matchplay");

  try {
    const client = createMatchPlayClient();
    const mpTournament = await client.getTournamentWithPlayers(tournament.matchplay_id);
    const validatedPlayers = mapMatchPlayPlayers(mpTournament.players);

    // Verify the submitted data matches what we get from Match Play
    const mpPlayerMap = new Map(validatedPlayers.map((p) => [p.matchplay_id, p]));

    for (const submitted of players) {
      const mpPlayer = mpPlayerMap.get(submitted.matchplay_id);
      if (!mpPlayer) {
        return { error: `Player with Match Play ID ${submitted.matchplay_id} not found in Match Play tournament` };
      }
      // Use the validated data from Match Play instead of client-submitted data
    }

    // Use the validated Match Play data instead of client-submitted data
    // This ensures we only import data that actually exists in Match Play
    players = validatedPlayers;
  } catch (err) {
    console.error("Error validating against Match Play:", err);
    return { error: "Failed to validate players against Match Play. Please try again." };
  }

  // Validate player count
  if (players.length > tournament.player_count) {
    return {
      error: `Too many players. Maximum is ${tournament.player_count}.`,
    };
  }

  // Check if there are existing brackets
  const { count: bracketCount } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  // Get existing players for change detection
  const { data: existingPlayers } = await supabase
    .from("players")
    .select("seed, name, matchplay_id")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true });

  // Delete existing players
  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .eq("tournament_id", tournamentId);

  if (deleteError) {
    console.error("Error deleting existing players:", deleteError);
    return { error: "Failed to clear existing players" };
  }

  // Insert new players from Match Play
  const playersToInsert = players.map((p) => ({
    tournament_id: tournamentId,
    name: p.name,
    seed: p.seed,
    matchplay_id: p.matchplay_id,
    ifpa_id: p.ifpa_id,
  }));

  const { error: insertError } = await supabase
    .from("players")
    .insert(playersToInsert);

  if (insertError) {
    console.error("Error inserting players:", insertError);
    return { error: "Failed to insert players" };
  }

  // Log seeding change if brackets exist
  if (bracketCount && bracketCount > 0 && existingPlayers) {
    // Determine affected seeds
    const affectedSeeds: number[] = [];
    const existingBySeed = new Map(existingPlayers.map((p) => [p.seed, p]));

    for (const newPlayer of players) {
      const existing = existingBySeed.get(newPlayer.seed);
      if (!existing || existing.name !== newPlayer.name || existing.matchplay_id !== newPlayer.matchplay_id) {
        affectedSeeds.push(newPlayer.seed);
      }
    }

    // Check for removed seeds
    for (const existing of existingPlayers) {
      if (!players.some((p) => p.seed === existing.seed)) {
        affectedSeeds.push(existing.seed);
      }
    }

    const uniqueAffectedSeeds = [...new Set(affectedSeeds)].sort((a, b) => a - b);

    if (uniqueAffectedSeeds.length > 0) {
      await supabase.from("seeding_change_log").insert({
        tournament_id: tournamentId,
        changed_by: auth.user.id,
        change_type: "bulk_import",
        affected_seeds: uniqueAffectedSeeds,
        description: `Match Play import: ${players.length} players (${uniqueAffectedSeeds.length} seeds affected)`,
      });
    }
  }

  revalidatePath(`/admin/tournament/${tournamentId}`);
  return { success: true, count: players.length };
}
