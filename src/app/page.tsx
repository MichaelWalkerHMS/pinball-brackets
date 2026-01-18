import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ResponsiveHeader from "@/components/ResponsiveHeader";
import SiteLogo from "@/components/SiteLogo";
import { MyBracketsTable, CreateBracketWizard } from "@/components/dashboard";
import { loadUserBrackets } from "@/app/tournament/[id]/actions";
import TournamentWizard from "@/components/landing/TournamentWizard";
import PendingBracketHandler from "@/components/landing/PendingBracketHandler";
import type { Tournament } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch tournaments with results count to determine lock status
  const { data: tournamentsRaw, error } = await supabase
    .from("tournaments")
    .select("*, results(count)");

  // Transform to add has_results boolean
  const tournaments = tournamentsRaw?.map((t) => ({
    ...t,
    has_results: (t.results?.[0]?.count ?? 0) > 0,
    results: undefined, // Remove the raw results array
  })) as Tournament[] | null;

  // Fetch user brackets if logged in
  const userBrackets = user ? await loadUserBrackets() : [];

  // Logged-in user sees dashboard
  if (user) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        {/* Handler for pending bracket creation from logged-out wizard */}
        <PendingBracketHandler userId={user.id} />

        {/* Header */}
        <div className="flex justify-between items-center gap-4 mb-6">
          <h1><SiteLogo size="md" /></h1>
          <div className="flex-shrink-0">
            <ResponsiveHeader />
          </div>
        </div>

        {/* Content with max-width */}
        <div className="max-w-4xl mx-auto">
          {/* Championship Banner */}
          <div className="mb-6 p-4 bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg">
            <p className="font-medium text-[rgb(var(--color-warning-text))]">
              Congratulations to everyone who competed in yesterday&apos;s Open championships and those in today&apos;s Women&apos;s championships. Good luck!
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--color-warning-text))]">
              Last-minute changes to participants will impact the seeding and your brackets - there is no perfect way to auto-adjust them, so please review them prior to the tournament start if you want to make any changes.
            </p>
          </div>

          {/* My Brackets Section */}
          <div className="mb-8 p-6 border border-[rgb(var(--color-border-primary))] rounded-lg bg-[rgb(var(--color-bg-primary))]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              My Brackets
            </h2>
            <MyBracketsTable brackets={userBrackets} />
          </div>

          {/* Create New Bracket Section */}
          <div className="p-6 border border-[rgb(var(--color-border-primary))] rounded-lg bg-[rgb(var(--color-bg-primary))]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Bracket
            </h2>
            {error ? (
              <div className="text-[rgb(var(--color-error-icon))]">
                <p className="font-medium">Error loading tournaments:</p>
                <p className="text-sm">{error.message}</p>
              </div>
            ) : tournaments && tournaments.length > 0 ? (
              <CreateBracketWizard tournaments={tournaments as Tournament[]} />
            ) : (
              <p className="text-[rgb(var(--color-text-secondary))]">No tournaments available yet.</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Logged-out user sees landing page with tournament wizard
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 pt-16">
      {/* Auth status bar */}
      <div className="absolute top-4 right-4">
        <ResponsiveHeader />
      </div>

      <h1 className="mb-4 text-center">
        <SiteLogo size="lg" />
      </h1>
      <p className="text-lg text-[rgb(var(--color-text-secondary))] mb-8 text-center">
        Think you know who will win the IFPA State Championship this year?
        <br />
        Prove it by making free March Madness-style brackets!
      </p>

      {/* Championship Banner */}
      <div className="mb-6 p-4 bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg max-w-2xl w-full">
        <p className="font-medium text-[rgb(var(--color-warning-text))]">
          Congratulations to everyone who competed in yesterday&apos;s Open championships and those in today&apos;s Women&apos;s championships. Good luck!
        </p>
        <p className="mt-2 text-sm text-[rgb(var(--color-warning-text))]">
          Last-minute changes to participants will impact the seeding and your brackets - there is no perfect way to auto-adjust them, so please review them prior to the tournament start if you want to make any changes.
        </p>
      </div>

      {/* Tournament wizard */}
      <div className="mt-4 p-6 border border-[rgb(var(--color-border-primary))] rounded-lg max-w-2xl w-full bg-[rgb(var(--color-bg-primary))]">
        <h2 className="text-xl font-semibold mb-4">Explore Tournaments</h2>

        {error ? (
          <div className="text-[rgb(var(--color-error-icon))]">
            <p className="font-medium">Error loading tournaments:</p>
            <p className="text-sm">{error.message}</p>
          </div>
        ) : tournaments && tournaments.length > 0 ? (
          <TournamentWizard tournaments={tournaments as Tournament[]} />
        ) : (
          <p className="text-[rgb(var(--color-text-secondary))]">No tournaments available yet.</p>
        )}
      </div>

      {/* Call to action for logged out users */}
      <div className="mt-8 text-center">
        <p className="text-[rgb(var(--color-text-secondary))] mb-4">
          Create an account to start predicting!
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="px-6 py-2 border border-[rgb(var(--color-accent-primary))] text-[rgb(var(--color-accent-primary))] rounded-lg hover:bg-[rgb(var(--color-accent-light))] font-medium"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
