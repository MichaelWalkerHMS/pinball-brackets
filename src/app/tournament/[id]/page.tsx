import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaderboard } from "./actions";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import ResponsiveHeader from "@/components/ResponsiveHeader";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentHubPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (tournamentError || !tournament) {
    notFound();
  }

  // Check if predictions are locked (locked when results exist)
  const { count: resultCount } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", id);

  const isLocked = (resultCount ?? 0) > 0;

  // Fetch leaderboard data
  const { entries, userBracketIds } = await getLeaderboard(id);

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <Link
            href="/"
            className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm mb-2 inline-block"
          >
            <span className="hidden sm:inline">&larr; Back to Tournaments</span>
            <span className="sm:hidden">&larr; Back</span>
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {tournament.player_count} players &bull;{" "}
            <span
              className={
                isLocked ? "text-[rgb(var(--color-error-icon))] font-medium" : "text-[rgb(var(--color-success-icon))]"
              }
            >
              {isLocked ? "Predictions Locked" : "Predictions Open"}
            </span>
          </p>
        </div>
        <div className="flex-shrink-0">
          <ResponsiveHeader />
        </div>
      </div>

      {/* Content with max-width */}
      <div className="max-w-4xl mx-auto">
        {/* User CTA Section */}
        <div className="mb-6">
          {user ? (
            <div className="p-4 bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border-primary))] rounded-lg">
              {userBracketIds.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm sm:text-base text-[rgb(var(--color-text-primary))]">
                    You have {userBracketIds.length} bracket{userBracketIds.length > 1 ? "s" : ""} for this tournament.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!isLocked && (
                      <Link
                        href="/"
                        className="px-4 py-2 border border-[rgb(var(--color-accent-primary))] text-[rgb(var(--color-accent-primary))] rounded-lg hover:bg-[rgb(var(--color-accent-light))] font-medium text-center"
                      >
                        Create Another
                      </Link>
                    )}
                    <Link
                      href="/"
                      className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium text-center"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm sm:text-base text-[rgb(var(--color-text-primary))]">
                    {isLocked
                      ? "Predictions are locked for this tournament."
                      : "You haven't created a bracket yet."}
                  </p>
                  {!isLocked && (
                    <Link
                      href="/"
                      className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium text-center"
                    >
                      Create Your Bracket
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[rgb(var(--color-accent-light))] border border-[rgb(var(--color-accent-primary))] rounded-lg">
              <p className="text-[rgb(var(--color-accent-text))]">
                <Link href="/login" className="font-medium hover:underline">
                  Log in
                </Link>{" "}
                or{" "}
                <Link href="/signup" className="font-medium hover:underline">
                  sign up
                </Link>{" "}
                to create your bracket prediction!
              </p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <Leaderboard entries={entries} currentUserId={user?.id || null} />
      </div>
    </main>
  );
}
