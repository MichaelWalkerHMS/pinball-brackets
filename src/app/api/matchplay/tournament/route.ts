import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMatchPlayClient, MatchPlayError } from "@/lib/matchplay";

/**
 * GET /api/matchplay/tournament?id=<matchplay_id>
 *
 * Fetches tournament details from Match Play Events API.
 * Returns tournament data formatted for form pre-fill.
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

  // Get Match Play tournament ID from query params
  const matchplayId = request.nextUrl.searchParams.get("id");
  if (!matchplayId) {
    return NextResponse.json(
      { error: "Missing Match Play tournament ID" },
      { status: 400 }
    );
  }

  try {
    const client = createMatchPlayClient();
    const tournament = await client.getTournament(matchplayId);

    // Map Match Play data to our form format
    // Note: Match Play returns startUtc/endUtc, not startDate/endDate
    const mpData = tournament as Record<string, unknown>;
    const bracketSize = mpData.bracketSize as number | undefined;
    const startUtc = mpData.startUtc as string | null;

    // Calculate end date as 10 hours after start date (Match Play end date is often same as start)
    let endDate = "";
    if (startUtc) {
      const startDate = new Date(startUtc);
      const calculatedEnd = new Date(startDate.getTime() + 10 * 60 * 60 * 1000); // +10 hours
      endDate = calculatedEnd.toISOString();
    }

    // Determine if we can auto-set player count
    let player_count: 16 | 24 | null = null;
    let player_count_warning: string | null = null;

    // Match Play uses bracketSize 32 for 24-player tournaments, 16 for 16-player
    if (bracketSize === 16) {
      player_count = 16;
    } else if (bracketSize === 32) {
      player_count = 24;
    } else if (bracketSize) {
      player_count_warning = `Match Play tournament has bracket size ${bracketSize}. This app only supports 16-player (bracketSize 16) or 24-player (bracketSize 32) brackets. Please set the player count manually.`;
    }

    const formData = {
      name: tournament.name,
      start_date: startUtc || "",
      end_date: endDate,
      player_count,
      player_count_warning,
    };

    return NextResponse.json({ data: formData });
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
    console.error("Error fetching Match Play tournament:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament from Match Play" },
      { status: 500 }
    );
  }
}
