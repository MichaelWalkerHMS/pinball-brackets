import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Tournament, Player, Bracket, Pick, Result } from "@/lib/types";
import BracketView from "@/components/bracket/Bracket";
import ResponsiveHeader from "@/components/ResponsiveHeader";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata with og:url pointing to public view URL
// This ensures shared edit links show correct preview and canonical URL
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch bracket info (without user filter - we just need metadata)
  const { data: bracket } = await supabase
    .from("brackets")
    .select("name, user_id, tournament_id, is_public")
    .eq("id", id)
    .single();

  // Return generic metadata if bracket not found
  if (!bracket) {
    return {
      title: "Edit Bracket | Pinball Brackets",
      description: "Edit your bracket predictions for IFPA pinball tournaments.",
    };
  }

  // Fetch tournament name
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name")
    .eq("id", bracket.tournament_id)
    .single();

  // Fetch owner's display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", bracket.user_id)
    .single();

  const ownerName = profile?.display_name || "Anonymous";
  const bracketName = bracket.name;
  const tournamentName = tournament?.name || "Tournament";

  // Build title based on whether bracket has a name
  const title = bracketName
    ? `${ownerName}'s "${bracketName}" Bracket | Pinball Brackets`
    : `${ownerName}'s Bracket | Pinball Brackets`;

  const description = `Check out my bracket for the ${tournamentName}!`;

  // Point og:url to public view so crawlers use correct canonical URL
  const publicUrl = `https://www.pinballbrackets.com/bracket/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: publicUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BracketEditPage({ params }: PageProps) {
  const { id: bracketId } = await params;
  const supabase = await createClient();

  // Get current user - require authentication for editing
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to public view (not login)
  // This improves UX when edit URLs are shared - visitors see the bracket
  if (!user) {
    redirect(`/bracket/${bracketId}`);
  }

  // Fetch bracket (must belong to current user)
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .eq("user_id", user.id)
    .single();

  if (bracketError || !bracket) {
    notFound();
  }

  const userBracket = bracket as Bracket;

  // Fetch tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", bracket.tournament_id)
    .single();

  if (tournamentError || !tournament) {
    notFound();
  }

  // Fetch players for this tournament
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", bracket.tournament_id)
    .order("seed", { ascending: true });

  // Fetch picks for this bracket
  const { data: picks } = await supabase
    .from("picks")
    .select("*")
    .eq("bracket_id", bracketId);

  const userPicks = (picks || []) as Pick[];

  // Fetch results for this tournament (for display purposes)
  const { data: results } = await supabase
    .from("results")
    .select("*")
    .eq("tournament_id", bracket.tournament_id);

  // Check if predictions are locked
  const isLocked = new Date(tournament.lock_date) <= new Date();

  // Format dates for display
  const lockDate = new Date(tournament.lock_date);
  const formattedLockDate = lockDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Get bracket display name
  const bracketDisplayName = userBracket.name || "My Bracket";

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <Link
            href="/"
            className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm mb-2 inline-block"
          >
            <span className="hidden sm:inline">&larr; Back to Dashboard</span>
            <span className="sm:hidden">&larr; Back</span>
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{tournament.name}</h1>
          <p className="text-sm sm:text-base text-[rgb(var(--color-text-secondary))]">
            {bracketDisplayName} &bull; {tournament.player_count} players &bull;{" "}
            <span
              className={
                isLocked ? "text-[rgb(var(--color-error-icon))] font-medium" : "text-[rgb(var(--color-success-icon))]"
              }
            >
              {isLocked ? "Predictions Locked" : "Predictions Open"}
            </span>
          </p>
          {!isLocked && (
            <p className="text-xs sm:text-sm text-[rgb(var(--color-text-muted))] mt-1">
              Lock date: {formattedLockDate}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-shrink-0">
          <ResponsiveHeader />
        </div>
      </div>

      {/* Bracket Editor */}
      <BracketView
        tournament={tournament as Tournament}
        players={(players || []) as Player[]}
        existingBracket={userBracket}
        existingPicks={userPicks}
        results={(results || []) as Result[]}
        isLocked={isLocked}
        isLoggedIn={true}
      />
    </main>
  );
}
