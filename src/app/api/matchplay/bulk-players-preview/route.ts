import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMatchPlayClient,
  mapMatchPlayPlayers,
  comparePlayerLists,
  hasDiffChanges,
  MatchPlayError,
} from "@/lib/matchplay";
import type { PlayerDiff, MappedPlayer } from "@/lib/matchplay";
import type { TournamentStatus, TournamentType } from "@/lib/types";

interface TournamentPreview {
  tournament: {
    id: string;
    name: string;
    matchplay_id: string;
  };
  players: MappedPlayer[];
  diff: PlayerDiff | null;
  hasChanges: boolean;
  bracketCount: number;
  existingCount: number;
  error?: string;
}

interface PreviewResponse {
  success: boolean;
  tournaments: TournamentPreview[];
  error?: string;
}

/**
 * GET /api/matchplay/bulk-players-preview?tournamentId=<uuid>
 *
 * Fetches player diff from Match Play for a single tournament.
 * Called sequentially by the client with delays to avoid rate limiting.
 *
 * Query params:
 * - tournamentId: specific tournament to fetch (optional)
 * - tournamentType: 'open' | 'womens' (optional, for list mode)
 * - status: tournament status (optional, for list mode)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<PreviewResponse | { error: string }>> {
  const supabase = await createClient();

  // Verify authentication and admin status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const tournamentId = request.nextUrl.searchParams.get("tournamentId");
  const tournamentType = request.nextUrl.searchParams.get("tournamentType") as TournamentType | null;
  const status = request.nextUrl.searchParams.get("status") as TournamentStatus | null;

  // If no tournamentId, return list of tournaments with Match Play IDs (with optional filters)
  if (!tournamentId) {
    let query = supabase
      .from("tournaments")
      .select("id, name, matchplay_id")
      .not("matchplay_id", "is", null)
      .order("start_date", { ascending: false });

    if (tournamentType) {
      query = query.eq("tournament_type", tournamentType);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: tournaments, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch tournaments" },
        { status: 500 }
      );
    }

    // Return just the list of tournaments without fetching MP data
    return NextResponse.json({
      success: true,
      tournaments: (tournaments || []).map((t) => ({
        tournament: {
          id: t.id,
          name: t.name,
          matchplay_id: t.matchplay_id!,
        },
        players: [],
        diff: null,
        hasChanges: false,
        bracketCount: 0,
        existingCount: 0,
      })),
    });
  }

  // Fetch specific tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, matchplay_id")
    .eq("id", tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return NextResponse.json(
      { error: "Tournament not found" },
      { status: 404 }
    );
  }

  if (!tournament.matchplay_id) {
    return NextResponse.json(
      { error: "Tournament does not have a Match Play ID" },
      { status: 400 }
    );
  }

  // Get bracket count for this tournament
  const { count: bracketCount } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  // Get existing players
  const { data: existingPlayers, error: playersError } = await supabase
    .from("players")
    .select("name, seed, matchplay_id")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true });

  if (playersError) {
    return NextResponse.json(
      { error: "Failed to fetch existing players" },
      { status: 500 }
    );
  }

  // Fetch from Match Play
  try {
    const client = createMatchPlayClient();
    const mpTournament = await client.getTournamentWithPlayers(
      tournament.matchplay_id
    );
    const mappedPlayers = mapMatchPlayPlayers(mpTournament.players);

    // Check if existing players have matchplay_ids (have been imported before)
    const hasMatchPlayIds = existingPlayers?.some((p) => p.matchplay_id);

    let diff: PlayerDiff | null = null;
    let hasChanges = false;

    if (existingPlayers && existingPlayers.length > 0 && hasMatchPlayIds) {
      diff = comparePlayerLists(existingPlayers, mappedPlayers);
      hasChanges = hasDiffChanges(diff);
    } else if (mappedPlayers.length > 0) {
      // Fresh import - treat as "all added"
      hasChanges = existingPlayers?.length !== mappedPlayers.length ||
        !existingPlayers?.every((ep, i) => ep.name === mappedPlayers[i]?.name);
    }

    return NextResponse.json({
      success: true,
      tournaments: [
        {
          tournament: {
            id: tournament.id,
            name: tournament.name,
            matchplay_id: tournament.matchplay_id,
          },
          players: mappedPlayers,
          diff,
          hasChanges,
          bracketCount: bracketCount || 0,
          existingCount: existingPlayers?.length || 0,
        },
      ],
    });
  } catch (error) {
    if (error instanceof MatchPlayError) {
      return NextResponse.json({
        success: true,
        tournaments: [
          {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              matchplay_id: tournament.matchplay_id,
            },
            players: [],
            diff: null,
            hasChanges: false,
            bracketCount: bracketCount || 0,
            existingCount: existingPlayers?.length || 0,
            error: error.message,
          },
        ],
      });
    }

    console.error("Error fetching from Match Play:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Match Play" },
      { status: 500 }
    );
  }
}
