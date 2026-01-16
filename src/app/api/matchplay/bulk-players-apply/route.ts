import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMatchPlayClient,
  mapMatchPlayPlayers,
  MatchPlayError,
} from "@/lib/matchplay";
import { revalidatePath } from "next/cache";

interface TournamentToApply {
  tournamentId: string;
}

interface TournamentApplyResult {
  tournamentId: string;
  tournamentName: string;
  imported: number;
  error?: string;
}

interface ApplyResponse {
  success: boolean;
  tournaments: TournamentApplyResult[];
  totalImported: number;
  error?: string;
}

/**
 * POST /api/matchplay/bulk-players-apply
 *
 * Applies player imports for multiple tournaments.
 * Re-validates against Match Play API for security.
 *
 * Body: { tournaments: [{ tournamentId: string }] }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApplyResponse>> {
  const supabase = await createClient();

  // Verify authentication and admin status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        error: "Not authenticated",
      },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        error: "Not authorized",
      },
      { status: 403 }
    );
  }

  // Parse request body
  let body: { tournaments: TournamentToApply[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        error: "Invalid request body",
      },
      { status: 400 }
    );
  }

  if (!body.tournaments || !Array.isArray(body.tournaments)) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        error: "Missing tournaments array",
      },
      { status: 400 }
    );
  }

  // Create Match Play client
  let client;
  try {
    client = createMatchPlayClient();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize Match Play client";
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        error: message,
      },
      { status: 500 }
    );
  }

  const results: TournamentApplyResult[] = [];
  let totalImported = 0;

  // Process each tournament
  for (const item of body.tournaments) {
    const { tournamentId } = item;

    // Fetch tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, matchplay_id, player_count")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      results.push({
        tournamentId,
        tournamentName: "Unknown",
        imported: 0,
        error: "Tournament not found",
      });
      continue;
    }

    if (!tournament.matchplay_id) {
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: "No Match Play ID configured",
      });
      continue;
    }

    // Re-fetch from Match Play for security (prevents data tampering)
    let validatedPlayers;
    try {
      const mpTournament = await client.getTournamentWithPlayers(
        tournament.matchplay_id
      );
      validatedPlayers = mapMatchPlayPlayers(mpTournament.players);
    } catch (error) {
      const errorMsg =
        error instanceof MatchPlayError
          ? error.message
          : "Failed to fetch from Match Play";
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: errorMsg,
      });
      continue;
    }

    if (validatedPlayers.length === 0) {
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: "No players found in Match Play",
      });
      continue;
    }

    // Validate player count
    if (validatedPlayers.length > tournament.player_count) {
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: `Too many players (${validatedPlayers.length} > ${tournament.player_count})`,
      });
      continue;
    }

    // Get bracket count for seeding change log
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
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: "Failed to clear existing players",
      });
      continue;
    }

    // Insert new players
    const playersToInsert = validatedPlayers.map((p) => ({
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
      results.push({
        tournamentId,
        tournamentName: tournament.name,
        imported: 0,
        error: "Failed to insert players",
      });
      continue;
    }

    // Log seeding change if brackets exist
    if (bracketCount && bracketCount > 0 && existingPlayers) {
      const affectedSeeds: number[] = [];
      const existingBySeed = new Map(existingPlayers.map((p) => [p.seed, p]));

      for (const newPlayer of validatedPlayers) {
        const existing = existingBySeed.get(newPlayer.seed);
        if (
          !existing ||
          existing.name !== newPlayer.name ||
          existing.matchplay_id !== newPlayer.matchplay_id
        ) {
          affectedSeeds.push(newPlayer.seed);
        }
      }

      // Check for removed seeds
      for (const existing of existingPlayers) {
        if (!validatedPlayers.some((p) => p.seed === existing.seed)) {
          affectedSeeds.push(existing.seed);
        }
      }

      const uniqueAffectedSeeds = [...new Set(affectedSeeds)].sort(
        (a, b) => a - b
      );

      if (uniqueAffectedSeeds.length > 0) {
        await supabase.from("seeding_change_log").insert({
          tournament_id: tournamentId,
          changed_by: user.id,
          change_type: "bulk_import",
          affected_seeds: uniqueAffectedSeeds,
          description: `Bulk Match Play sync: ${validatedPlayers.length} players (${uniqueAffectedSeeds.length} seeds affected)`,
        });
      }
    }

    results.push({
      tournamentId,
      tournamentName: tournament.name,
      imported: validatedPlayers.length,
    });
    totalImported += validatedPlayers.length;

    // Revalidate the tournament page
    revalidatePath(`/admin/tournament/${tournamentId}`);
  }

  // Revalidate admin dashboard
  revalidatePath("/admin");

  return NextResponse.json({
    success: true,
    tournaments: results,
    totalImported,
  });
}
