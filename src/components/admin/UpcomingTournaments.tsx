"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Tournament } from "@/lib/types";

interface UpcomingTournamentsProps {
  tournaments: Tournament[];
}

export default function UpcomingTournaments({ tournaments }: UpcomingTournamentsProps) {
  const [selectedState, setSelectedState] = useState<string>("all");

  // Get unique states from tournaments
  const states = useMemo(() => {
    const uniqueStates = [...new Set(tournaments.map((t) => t.state))].sort();
    return uniqueStates;
  }, [tournaments]);

  // Filter tournaments by selected state
  const filteredTournaments = useMemo(() => {
    if (selectedState === "all") return tournaments;
    return tournaments.filter((t) => t.state === selectedState);
  }, [tournaments, selectedState]);

  const badgeColor = "bg-[rgb(var(--color-accent-light))] text-[rgb(var(--color-accent-text))]";

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">Upcoming</h2>
        {states.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[rgb(var(--color-text-muted))]">Filter:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedState("all")}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedState === "all"
                    ? "bg-[rgb(var(--color-accent-primary))] text-white"
                    : "bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))]"
                }`}
              >
                All
              </button>
              {states.map((state) => (
                <button
                  key={state}
                  onClick={() => setSelectedState(state)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedState === state
                      ? "bg-[rgb(var(--color-accent-primary))] text-white"
                      : "bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))]"
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredTournaments.length > 0 ? (
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] divide-y divide-[rgb(var(--color-border-primary))]">
          {filteredTournaments.map((tournament) => (
            <TournamentRow
              key={tournament.id}
              tournament={tournament}
              badgeColor={badgeColor}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-4 text-center">
          <p className="text-[rgb(var(--color-text-muted))]">No upcoming tournaments in {selectedState}</p>
        </div>
      )}
    </div>
  );
}

function TournamentRow({
  tournament,
  badgeColor,
}: {
  tournament: Tournament;
  badgeColor: string;
}) {
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
            {formattedDate} &bull; {tournament.player_count} players &bull; {tournament.state}
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
