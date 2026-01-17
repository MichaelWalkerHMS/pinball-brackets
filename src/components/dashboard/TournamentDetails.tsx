import type { Tournament } from "@/lib/types";

interface TournamentDetailsProps {
  tournament: Tournament;
}

export default function TournamentDetails({ tournament }: TournamentDetailsProps) {
  // Tournament is locked if it has results
  const isLocked = tournament.has_results ?? false;

  const formattedDate = new Date(tournament.start_date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mt-3 p-3 bg-[rgb(var(--color-bg-tertiary))] rounded-lg text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[rgb(var(--color-text-secondary))]">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formattedDate}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {tournament.player_count} players
        </span>
        <span className={`flex items-center gap-1 ${isLocked ? "text-[rgb(var(--color-error-icon))]" : "text-[rgb(var(--color-success-icon))]"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {isLocked ? "Locked" : "Open"}
        </span>
      </div>
    </div>
  );
}
