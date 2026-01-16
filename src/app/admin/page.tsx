import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Tournament } from "@/lib/types";
import BulkSyncButton from "@/components/admin/BulkSyncButton";
import BulkPlayerSyncButton from "@/components/admin/BulkPlayerSyncButton";
import UpcomingTournaments from "@/components/admin/UpcomingTournaments";
import TournamentRow from "@/components/admin/TournamentRow";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Fetch all tournaments (admin can see all, including inactive)
  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching tournaments:", error);
  }

  const tournamentList = (tournaments || []) as Tournament[];

  // Group by status
  const upcoming = tournamentList.filter((t) => t.status === "upcoming");
  const inProgress = tournamentList.filter((t) => t.status === "in_progress");
  const completed = tournamentList.filter((t) => t.status === "completed");

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Tournaments</h1>
          <p className="text-[rgb(var(--color-text-secondary))] mt-1">
            Manage tournaments, players, and results
          </p>
        </div>
        <Link
          href="/admin/tournament/new"
          className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
        >
          + New Tournament
        </Link>
      </div>

      {/* Match Play Sync Section */}
      <div className="mb-6 space-y-4">
        <BulkPlayerSyncButton />
        <BulkSyncButton />
      </div>

      {/* Tournament Sections */}
      {inProgress.length > 0 && (
        <TournamentSection
          title="In Progress"
          tournaments={inProgress}
          badgeColor="bg-[rgb(var(--color-warning-bg))] text-[rgb(var(--color-warning-text))]"
        />
      )}

      {upcoming.length > 0 && (
        <UpcomingTournaments tournaments={upcoming} />
      )}

      {completed.length > 0 && (
        <TournamentSection
          title="Completed"
          tournaments={completed}
          badgeColor="bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))]"
        />
      )}

      {tournamentList.length === 0 && (
        <div className="text-center py-12 bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
          <p className="text-[rgb(var(--color-text-muted))]">No tournaments yet.</p>
          <Link
            href="/admin/tournament/new"
            className="text-[rgb(var(--color-accent-primary))] hover:underline mt-2 inline-block"
          >
            Create your first tournament
          </Link>
        </div>
      )}
    </div>
  );
}

function TournamentSection({
  title,
  tournaments,
  badgeColor,
}: {
  title: string;
  tournaments: Tournament[];
  badgeColor: string;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">{title}</h2>
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] divide-y divide-[rgb(var(--color-border-primary))]">
        {tournaments.map((tournament) => (
          <TournamentRow
            key={tournament.id}
            tournament={tournament}
            badgeColor={badgeColor}
          />
        ))}
      </div>
    </div>
  );
}

