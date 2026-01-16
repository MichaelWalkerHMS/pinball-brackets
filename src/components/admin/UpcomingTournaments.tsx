"use client";

import { useState, useMemo } from "react";
import type { Tournament } from "@/lib/types";
import TournamentRow from "@/components/admin/TournamentRow";

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
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
          >
            <option value="all">All States</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredTournaments.length > 0 ? (
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] divide-y divide-[rgb(var(--color-border-primary))]">
          {filteredTournaments.map((tournament) => (
            <TournamentRow
              key={tournament.id}
              tournament={tournament}
              badgeColor={badgeColor}
              showState
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
