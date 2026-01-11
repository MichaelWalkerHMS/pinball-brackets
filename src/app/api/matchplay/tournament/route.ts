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
    const formData = {
      name: tournament.name,
      start_date: tournament.startDate || "",
      end_date: tournament.endDate || "",
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
