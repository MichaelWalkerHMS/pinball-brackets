import Link from "next/link";
import type { Tournament } from "@/lib/types";

interface TournamentRowProps {
  tournament: Tournament;
  badgeColor: string;
  showState?: boolean;
}

export default function TournamentRow({
  tournament,
  badgeColor,
  showState = false,
}: TournamentRowProps) {
  const startDate = new Date(tournament.start_date);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/admin/tournament/${tournament.id}`}
      className="flex items-center justify-between p-4 hover:bg-[rgb(var(--color-bg-secondary))] transition-colors"
    >
      <div className="flex items-center gap-4">
        <div>
          <h3 className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.name}</h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            {formattedDate} &bull; {tournament.player_count} players
            {showState && <> &bull; {tournament.state}</>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
          {tournament.status.replace("_", " ")}
        </span>
        {!tournament.is_active && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
            Hidden
          </span>
        )}
        <span className="text-[rgb(var(--color-text-muted))]">&rarr;</span>
      </div>
    </Link>
  );
}
