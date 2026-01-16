import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Tournament, Player, Bracket, Pick, Result } from "@/lib/types";
import BracketView from "@/components/bracket/Bracket";
import ResponsiveHeader from "@/components/ResponsiveHeader";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch bracket with minimal fields
  const { data: bracket } = await supabase
    .from("brackets")
    .select("name, user_id, tournament_id, is_public")
    .eq("id", id)
    .single();

  // Return generic metadata if bracket not found or is private
  if (!bracket || !bracket.is_public) {
    return {
      title: "Bracket | Pinball Brackets",
      description: "View bracket predictions for IFPA pinball tournaments.",
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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: "/pinball-bracket-logo-expanded.png",
          width: 1200,
          height: 630,
          alt: "Pinball Brackets",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/pinball-bracket-logo-expanded.png"],
    },
  };
}

export default async function BracketPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch bracket by ID
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .single();

  if (bracketError || !bracket) {
    notFound();
  }

  // Check access: public brackets viewable by all, private only by owner
  const isOwner = user?.id === bracket.user_id;
  if (!bracket.is_public && !isOwner) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 pt-16">
        <div className="absolute top-4 right-4">
          <ResponsiveHeader />
        </div>
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold mb-4">Private Bracket</h1>
          <p className="text-sm sm:text-base text-[rgb(var(--color-text-secondary))] mb-6">
            This bracket is private and can only be viewed by its owner.
          </p>
          <Link
            href={`/tournament/${bracket.tournament_id}`}
            className="text-[rgb(var(--color-accent-primary))] hover:underline"
          >
            <span className="hidden sm:inline">&larr; Back to Tournament</span>
            <span className="sm:hidden">&larr; Back</span>
          </Link>
        </div>
      </main>
    );
  }

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
    .eq("bracket_id", bracket.id);

  // Fetch results for this tournament (for display purposes)
  const { data: results } = await supabase
    .from("results")
    .select("*")
    .eq("tournament_id", bracket.tournament_id);

  // Query seeding changes AFTER the bracket was last saved
  const { data: seedingChanges } = await supabase
    .from("seeding_change_log")
    .select("affected_seeds, created_at")
    .eq("tournament_id", bracket.tournament_id)
    .gt("created_at", bracket.updated_at)
    .order("created_at", { ascending: false });

  // Collect unique affected seeds and count changes
  const affectedSeeds = seedingChanges
    ? [...new Set(seedingChanges.flatMap((c) => c.affected_seeds))]
    : [];
  const seedingChangeCount = seedingChanges?.length || 0;

  // Fetch owner's profile for display name
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", bracket.user_id)
    .single();

  const ownerName = ownerProfile?.display_name || "Anonymous";
  const bracketName = bracket.name || null;

  // Check if predictions are locked
  const isLocked = new Date(tournament.lock_date) <= new Date();

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tournament/${bracket.tournament_id}`}
            className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm mb-2 inline-block"
          >
            <span className="hidden sm:inline">&larr; Back to Tournament</span>
            <span className="sm:hidden">&larr; Back</span>
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            {bracketName || `${ownerName}'s Bracket`}
          </h1>
          {bracketName && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">by {ownerName}</p>
          )}
          <p className="text-xs sm:text-sm text-[rgb(var(--color-text-muted))] mt-1">
            {tournament.name}
          </p>
        </div>
        <div className="flex-shrink-0">
          <ResponsiveHeader />
        </div>
      </div>

      {/* Bracket */}
      <BracketView
        tournament={tournament as Tournament}
        players={(players || []) as Player[]}
        existingBracket={bracket as Bracket}
        existingPicks={(picks || []) as Pick[]}
        results={(results || []) as Result[]}
        isLocked={isLocked}
        isLoggedIn={isOwner}
        bracketName={bracketName}
        ownerName={ownerName}
        affectedSeeds={affectedSeeds}
        seedingChangeCount={seedingChangeCount}
      />

      {/* CTA for logged-out users */}
      {!user && (
        <div className="mt-8 p-6 bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border-primary))] rounded-lg text-center max-w-2xl mx-auto">
          <p className="text-lg font-medium text-[rgb(var(--color-text-primary))] mb-2">
            Want to make your own predictions?
          </p>
          <p className="text-[rgb(var(--color-text-secondary))] mb-4">
            Create your bracket and compete on the leaderboard!
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Create Your Bracket
          </Link>
        </div>
      )}
    </main>
  );
}
