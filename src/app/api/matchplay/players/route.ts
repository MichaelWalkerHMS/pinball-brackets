import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMatchPlayClient,
  MatchPlayError,
  mapMatchPlayPlayers,
  comparePlayerLists,
  hasDiffChanges,
} from "@/lib/matchplay";

/**
 * GET /api/matchplay/players?matchplayId=<id>&tournamentId=<uuid>
 *
 * Fetches players from Match Play Events API.
 * If tournamentId is provided, also compares with existing players to generate a diff.
 *
 * Returns:
 * - players: Array of mapped player objects
 * - diff: Object describing changes (only if tournamentId provided and players exist)
 * - hasChanges: Boolean indicating if there are differences
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const supabase = await createClient();
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

  // Get parameters
  const matchplayId = request.nextUrl.searchParams.get("matchplayId");
  const tournamentId = request.nextUrl.searchParams.get("tournamentId");

  if (!matchplayId) {
    return NextResponse.json(
      { error: "Missing Match Play tournament ID" },
      { status: 400 }
    );
  }

  try {
    const client = createMatchPlayClient();
    const tournament = await client.getTournamentWithPlayers(matchplayId);

    // Debug: log raw MP player data
    console.log("=== Match Play API Response ===");
    console.log("Total players returned:", tournament.players?.length);
    console.log("First 3 raw players:", JSON.stringify(tournament.players?.slice(0, 3), null, 2));

    // Map Match Play players to our format
    const mappedPlayers = mapMatchPlayPlayers(tournament.players);

    // Debug: log mapped players
    console.log("Mapped players count:", mappedPlayers.length);
    console.log("First 3 mapped players:", JSON.stringify(mappedPlayers.slice(0, 3), null, 2));

    // If tournamentId provided, fetch existing players and compare
    if (tournamentId) {
      const { data: existingPlayers, error: fetchError } = await supabase
        .from("players")
        .select("name, seed, matchplay_id")
        .eq("tournament_id", tournamentId)
        .order("seed", { ascending: true });

      if (fetchError) {
        console.error("Error fetching existing players:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch existing players" },
          { status: 500 }
        );
      }

      // Check if any existing players have matchplay_id (have been imported before)
      const hasMatchPlayIds = existingPlayers?.some((p) => p.matchplay_id);

      if (existingPlayers && existingPlayers.length > 0 && hasMatchPlayIds) {
        // Compare and generate diff
        const diff = comparePlayerLists(existingPlayers, mappedPlayers);
        return NextResponse.json({
          players: mappedPlayers,
          diff,
          hasChanges: hasDiffChanges(diff),
          existingCount: existingPlayers.length,
        });
      }

      // No existing Match Play players - this is a fresh import
      return NextResponse.json({
        players: mappedPlayers,
        diff: null,
        hasChanges: false,
        existingCount: existingPlayers?.length || 0,
      });
    }

    // No tournamentId - just return players
    return NextResponse.json({
      players: mappedPlayers,
      diff: null,
      hasChanges: false,
      existingCount: 0,
    });
  } catch (error) {
    if (error instanceof MatchPlayError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Tournament not found on Match Play" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Error fetching Match Play players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players from Match Play" },
      { status: 500 }
    );
  }
}
