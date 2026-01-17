"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SaveBracketInput, LoadBracketResult, Bracket, Pick, LeaderboardEntry, DashboardBracket } from "@/lib/types";

/**
 * Load the current user's bracket and picks for a tournament
 */
export async function loadUserBracket(
  tournamentId: string
): Promise<LoadBracketResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { bracket: null, picks: [] };
  }

  // Get bracket
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("user_id", user.id)
    .eq("tournament_id", tournamentId)
    .single();

  if (!bracket) {
    return { bracket: null, picks: [] };
  }

  // Get picks
  const { data: picks } = await supabase
    .from("picks")
    .select("*")
    .eq("bracket_id", bracket.id);

  return {
    bracket: bracket as Bracket,
    picks: (picks || []) as Pick[],
  };
}

/**
 * Save or update a bracket with picks
 * If bracketId is provided, updates that specific bracket
 * Otherwise creates a new bracket
 */
export async function saveBracket(
  data: SaveBracketInput
): Promise<{ bracket: Bracket | null; error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { bracket: null, error: "Not authenticated" };
  }

  // Check lock status by checking if results exist
  const { count: resultCount } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", data.tournamentId);

  if ((resultCount ?? 0) > 0) {
    return { bracket: null, error: "Predictions are locked" };
  }

  let bracketId: string;

  if (data.bracketId) {
    // Update existing bracket by ID
    const { data: updatedBracket, error: updateError } = await supabase
      .from("brackets")
      .update({
        name: data.bracketName || null,
        is_public: data.isPublic,
        final_winner_games: data.finalWinnerGames,
        final_loser_games: data.finalLoserGames,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.bracketId)
      .eq("user_id", user.id) // Security: ensure user owns this bracket
      .select()
      .single();

    if (updateError) {
      return { bracket: null, error: updateError.message };
    }

    bracketId = updatedBracket.id;
  } else {
    // Insert new bracket
    const { data: newBracket, error: insertError } = await supabase
      .from("brackets")
      .insert({
        user_id: user.id,
        tournament_id: data.tournamentId,
        name: data.bracketName || null,
        is_public: data.isPublic,
        final_winner_games: data.finalWinnerGames,
        final_loser_games: data.finalLoserGames,
      })
      .select()
      .single();

    if (insertError) {
      return { bracket: null, error: insertError.message };
    }

    bracketId = newBracket.id;
  }

  // Delete existing picks for this bracket
  await supabase.from("picks").delete().eq("bracket_id", bracketId);

  // Insert new picks
  if (data.picks.length > 0) {
    const picksToInsert = data.picks.map((p) => ({
      bracket_id: bracketId,
      round: p.round,
      match_position: p.matchPosition,
      winner_seed: p.winnerSeed,
    }));

    const { error: picksError } = await supabase
      .from("picks")
      .insert(picksToInsert);

    if (picksError) {
      return { bracket: null, error: picksError.message };
    }
  }

  // Fetch and return the complete bracket
  const { data: finalBracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .single();

  return { bracket: finalBracket as Bracket, error: null };
}

/**
 * Check if predictions are locked for a tournament
 * Tournament is locked when it has at least one result
 */
export async function checkLockStatus(
  tournamentId: string
): Promise<{ locked: boolean }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const isLocked = (count ?? 0) > 0;
  return { locked: isLocked };
}

/**
 * Fetch leaderboard data for a tournament
 * Returns all public brackets + current user's brackets (even if private)
 */
export async function getLeaderboard(
  tournamentId: string
): Promise<{ entries: LeaderboardEntry[]; userBracketIds: string[] }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Query brackets with owner profile info and scoring columns
  // RLS will automatically filter: public brackets + user's own
  const { data: brackets, error } = await supabase
    .from("brackets")
    .select(
      `
      id,
      name,
      user_id,
      is_public,
      score,
      correct_champion,
      game_score_diff,
      total_correct,
      created_at,
      profiles!brackets_user_id_fkey (
        display_name
      )
    `
    )
    .eq("tournament_id", tournamentId)
    // Tiebreaker ordering: score DESC, correct_champion DESC, game_score_diff ASC (nulls last), total_correct DESC
    .order("score", { ascending: false, nullsFirst: false })
    .order("correct_champion", { ascending: false, nullsFirst: false })
    .order("game_score_diff", { ascending: true, nullsFirst: false })
    .order("total_correct", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error || !brackets) {
    return { entries: [], userBracketIds: [] };
  }

  // Transform to LeaderboardEntry format
  const entries: LeaderboardEntry[] = brackets.map((b) => {
    // Supabase join can return object or array depending on relationship
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return {
      id: b.id,
      name: b.name,
      owner_id: b.user_id,
      owner_display_name: profile?.display_name || "Anonymous",
      is_public: b.is_public,
      score: b.score,
      correct_champion: b.correct_champion,
      game_score_diff: b.game_score_diff,
      total_correct: b.total_correct,
      created_at: b.created_at,
    };
  });

  // Find all current user's bracket IDs
  const userBracketIds = user
    ? entries.filter((e) => e.owner_id === user.id).map((e) => e.id)
    : [];

  return { entries, userBracketIds };
}

/**
 * Load all brackets for the current user across all tournaments (for dashboard)
 */
export async function loadUserBrackets(): Promise<DashboardBracket[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Fetch all brackets with tournament info and pick counts
  const { data: brackets, error } = await supabase
    .from("brackets")
    .select(`
      id,
      name,
      tournament_id,
      is_public,
      score,
      created_at,
      final_winner_games,
      tournaments!brackets_tournament_id_fkey (
        name,
        state,
        year,
        player_count,
        status
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !brackets) {
    return [];
  }

  // Get pick counts for each bracket
  const bracketIds = brackets.map((b) => b.id);
  const { data: pickCounts } = await supabase
    .from("picks")
    .select("bracket_id")
    .in("bracket_id", bracketIds);

  // Count picks per bracket
  const pickCountMap = new Map<string, number>();
  pickCounts?.forEach((p) => {
    pickCountMap.set(p.bracket_id, (pickCountMap.get(p.bracket_id) || 0) + 1);
  });

  // Get leaderboard rankings for each tournament
  const tournamentIds = [...new Set(brackets.map((b) => b.tournament_id))];
  const rankingMap = new Map<string, number>(); // bracketId -> rank

  for (const tournamentId of tournamentIds) {
    const { entries } = await getLeaderboard(tournamentId);
    entries.forEach((entry, index) => {
      rankingMap.set(entry.id, index + 1);
    });
  }

  // Check lock status for each tournament (tournament is locked if it has results)
  const lockStatusMap = new Map<string, boolean>();
  for (const tournamentId of tournamentIds) {
    const { count } = await supabase
      .from("results")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);
    lockStatusMap.set(tournamentId, (count ?? 0) > 0);
  }

  // Transform to DashboardBracket format
  return brackets.map((b) => {
    const tournament = Array.isArray(b.tournaments) ? b.tournaments[0] : b.tournaments;
    const playerCount = tournament?.player_count || 24;
    // 24 players = 24 picks, 16 players = 16 picks
    const expectedPicks = playerCount === 16 ? 16 : 24;
    const pickCount = pickCountMap.get(b.id) || 0;
    const isLocked = lockStatusMap.get(b.tournament_id) ?? false;

    return {
      id: b.id,
      name: b.name,
      tournament_id: b.tournament_id,
      tournament_name: tournament?.name || "Unknown Tournament",
      tournament_state: tournament?.state || "",
      tournament_year: tournament?.year || new Date().getFullYear(),
      player_count: playerCount,
      tournament_status: tournament?.status || "upcoming",
      pick_count: pickCount,
      expected_picks: expectedPicks,
      is_complete: pickCount >= expectedPicks && b.final_winner_games !== null,
      is_public: b.is_public,
      score: b.score,
      rank: rankingMap.get(b.id) || null,
      is_locked: isLocked,
    };
  });
}

/**
 * Load a specific bracket by ID with its picks
 */
export async function loadBracketById(
  bracketId: string
): Promise<LoadBracketResult & { tournamentId: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { bracket: null, picks: [], tournamentId: null };
  }

  // Get bracket (must belong to user)
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .eq("user_id", user.id)
    .single();

  if (!bracket) {
    return { bracket: null, picks: [], tournamentId: null };
  }

  // Get picks
  const { data: picks } = await supabase
    .from("picks")
    .select("*")
    .eq("bracket_id", bracket.id);

  return {
    bracket: bracket as Bracket,
    picks: (picks || []) as Pick[],
    tournamentId: bracket.tournament_id,
  };
}

/**
 * Create a new empty bracket for a tournament
 */
export async function createBracket(
  tournamentId: string,
  bracketName: string
): Promise<{ bracket: Bracket | null; error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { bracket: null, error: "Not authenticated" };
  }

  // Check lock status by checking if results exist
  const { count: resultCount } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  if ((resultCount ?? 0) > 0) {
    return { bracket: null, error: "Predictions are locked" };
  }

  // Create new bracket
  const { data: newBracket, error: insertError } = await supabase
    .from("brackets")
    .insert({
      user_id: user.id,
      tournament_id: tournamentId,
      name: bracketName,
      is_public: true,
    })
    .select()
    .single();

  if (insertError) {
    return { bracket: null, error: insertError.message };
  }

  return { bracket: newBracket as Bracket, error: null };
}

/**
 * Count existing brackets for a user in a tournament (for generating default names)
 */
export async function countUserBracketsForTournament(
  tournamentId: string
): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { count } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("tournament_id", tournamentId);

  return count || 0;
}

/**
 * Delete a bracket and all its picks
 * Only the bracket owner can delete their own bracket
 */
export async function deleteBracket(
  bracketId: string
): Promise<{ success?: boolean; tournamentId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership
  const { data: bracket } = await supabase
    .from("brackets")
    .select("user_id, tournament_id")
    .eq("id", bracketId)
    .single();

  if (!bracket) {
    return { error: "Bracket not found" };
  }

  if (bracket.user_id !== user.id) {
    return { error: "Not authorized to delete this bracket" };
  }

  const tournamentId = bracket.tournament_id;

  // Delete picks first (foreign key constraint)
  const { error: picksError } = await supabase
    .from("picks")
    .delete()
    .eq("bracket_id", bracketId);

  if (picksError) {
    return { error: `Failed to delete picks: ${picksError.message}` };
  }

  // Delete bracket
  const { error } = await supabase
    .from("brackets")
    .delete()
    .eq("id", bracketId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tournament/${tournamentId}`);
  revalidatePath("/");
  return { success: true, tournamentId };
}
