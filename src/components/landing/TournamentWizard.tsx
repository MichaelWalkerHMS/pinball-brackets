"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Tournament } from "@/lib/types";
import TournamentDetails from "@/components/dashboard/TournamentDetails";
import AuthModal from "@/components/auth/AuthModal";

interface PendingBracketCreation {
  tournamentId: string;
  tournamentState: string;
  tournamentYear: number;
  timestamp: number;
}

interface TournamentWizardProps {
  tournaments: Tournament[];
}

export default function TournamentWizard({ tournaments }: TournamentWizardProps) {
  const router = useRouter();
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Get unique states from tournaments, sorted alphabetically
  const states = useMemo(() => {
    const stateSet = new Set(tournaments.map((t) => t.state));
    return Array.from(stateSet).sort();
  }, [tournaments]);

  // Filter tournaments by selected state, only show unlocked ones
  const filteredTournaments = useMemo(() => {
    if (!selectedState) return [];
    return tournaments.filter(
      (t) => t.state === selectedState && new Date(t.lock_date) > new Date()
    );
  }, [tournaments, selectedState]);

  // Get selected tournament object
  const selectedTournament = useMemo(() => {
    if (!selectedTournamentId) return null;
    return tournaments.find((t) => t.id === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  // Handle state selection
  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedTournamentId("");
  };

  // Handle tournament selection
  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
  };

  // Navigate to leaderboard
  const handleViewLeaderboard = () => {
    if (selectedTournamentId) {
      router.push(`/tournament/${selectedTournamentId}`);
    }
  };

  // Store intent and open auth modal
  const handleCreateBracket = () => {
    if (!selectedTournament) return;

    // Store pending bracket creation intent in sessionStorage
    const pendingData: PendingBracketCreation = {
      tournamentId: selectedTournament.id,
      tournamentState: selectedTournament.state,
      tournamentYear: selectedTournament.year,
      timestamp: Date.now(),
    };
    sessionStorage.setItem("pendingBracketCreation", JSON.stringify(pendingData));

    // Open auth modal
    setIsAuthModalOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        {/* Step 1: State dropdown */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgb(var(--color-accent-primary))] text-white text-xs mr-1">1</span>
            Select State/Province
          </label>
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:border-[rgb(var(--color-accent-primary))]"
          >
            <option value="">Choose State/Province...</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex items-center text-[rgb(var(--color-text-muted))] pb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Step 2: Tournament dropdown */}
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1 ${selectedState ? "bg-[rgb(var(--color-accent-primary))] text-white" : "bg-[rgb(var(--color-border-secondary))] text-[rgb(var(--color-text-muted))]"}`}>2</span>
            Select Tournament
          </label>
          <select
            value={selectedTournamentId}
            onChange={(e) => handleTournamentChange(e.target.value)}
            disabled={!selectedState}
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:border-[rgb(var(--color-accent-primary))] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {selectedState
                ? filteredTournaments.length > 0
                  ? "Select tournament..."
                  : "No open tournaments"
                : "Select a state/province first"}
            </option>
            {filteredTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tournament details and action buttons */}
      {selectedTournament && (
        <>
          <TournamentDetails tournament={selectedTournament} />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleViewLeaderboard}
              className="px-4 py-2 border border-[rgb(var(--color-accent-primary))] text-[rgb(var(--color-accent-primary))] rounded-lg hover:bg-[rgb(var(--color-accent-light))] font-medium transition-colors"
            >
              View Leaderboard
            </button>
            <button
              onClick={handleCreateBracket}
              className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium transition-colors"
            >
              Create Bracket
            </button>
          </div>
        </>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab="signup"
      />
    </div>
  );
}
