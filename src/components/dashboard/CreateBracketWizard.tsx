"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Tournament } from "@/lib/types";
import TournamentDetails from "./TournamentDetails";

interface CreateBracketWizardProps {
  tournaments: Tournament[];
}

export default function CreateBracketWizard({ tournaments }: CreateBracketWizardProps) {
  const router = useRouter();
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [bracketName, setBracketName] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get unique states from tournaments, sorted alphabetically
  const states = useMemo(() => {
    const stateSet = new Set(tournaments.map((t) => t.state));
    return Array.from(stateSet).sort();
  }, [tournaments]);

  // Filter tournaments by selected state (show all tournaments including completed)
  const filteredTournaments = useMemo(() => {
    if (!selectedState) return [];
    return tournaments.filter((t) => t.state === selectedState);
  }, [tournaments, selectedState]);

  // Get selected tournament object
  const selectedTournament = useMemo(() => {
    if (!selectedTournamentId) return null;
    return tournaments.find((t) => t.id === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  // Generate default bracket name when tournament is selected
  const generateDefaultName = async (tournament: Tournament) => {
    const { countUserBracketsForTournament } = await import(
      "@/app/tournament/[id]/actions"
    );
    const count = await countUserBracketsForTournament(tournament.id);
    return `${tournament.state} ${tournament.year} #${count + 1}`;
  };

  // Handle state selection
  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedTournamentId("");
    setBracketName("");
    setError(null);
  };

  // Handle tournament selection
  const handleTournamentChange = async (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    setError(null);

    if (tournamentId) {
      const tournament = tournaments.find((t) => t.id === tournamentId);
      if (tournament) {
        const defaultName = await generateDefaultName(tournament);
        setBracketName(defaultName);
      }
    } else {
      setBracketName("");
    }
  };

  // Handle bracket creation
  const handleCreate = async () => {
    if (!selectedTournamentId || !bracketName.trim()) {
      setError("Please select a tournament and enter a bracket name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { createBracket } = await import("@/app/tournament/[id]/actions");
      const result = await createBracket(selectedTournamentId, bracketName.trim());

      if (result.error) {
        setError(result.error);
        setIsCreating(false);
        return;
      }

      if (result.bracket) {
        // Redirect to bracket edit page
        router.push(`/bracket/${result.bracket.id}/edit`);
      }
    } catch {
      setError("Failed to create bracket. Please try again.");
      setIsCreating(false);
    }
  };

  const canCreate = selectedTournamentId && bracketName.trim() && !isCreating;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        {/* Step 1: State dropdown */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgb(var(--color-accent-primary))] text-white text-xs mr-1">1</span>
            Select State
          </label>
          <select
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:border-[rgb(var(--color-accent-primary))]"
          >
            <option value="">Choose State...</option>
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
                  : "No tournaments available"
                : "Select a state first"}
            </option>
            {filteredTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </div>

        {/* Only show bracket creation UI for tournaments without results */}
        {selectedTournament && !selectedTournament.has_results && (
          <>
            {/* Arrow */}
            <div className="hidden sm:flex items-center text-[rgb(var(--color-text-muted))] pb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Step 3: Bracket name + Create button */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1 bg-[rgb(var(--color-accent-primary))] text-white">3</span>
                Bracket Name
              </label>
              <input
                type="text"
                value={bracketName}
                onChange={(e) => setBracketName(e.target.value)}
                placeholder="Enter bracket name"
                maxLength={50}
                className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:border-[rgb(var(--color-accent-primary))]"
              />
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                canCreate
                  ? "bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))]"
                  : "bg-[rgb(var(--color-border-secondary))] text-[rgb(var(--color-text-muted))] cursor-not-allowed"
              }`}
            >
              {isCreating ? "Creating..." : "Create Bracket"}
            </button>
          </>
        )}

        {/* View Leaderboard button - always shown when tournament is selected */}
        {selectedTournament && (
          <button
            onClick={() => router.push(`/tournament/${selectedTournamentId}`)}
            className="px-6 py-2 rounded-lg font-medium transition-colors border border-[rgb(var(--color-accent-primary))] text-[rgb(var(--color-accent-primary))] hover:bg-[rgb(var(--color-accent-light))]"
          >
            View Leaderboard
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 text-sm text-[rgb(var(--color-error-icon))]">
          {error}
        </div>
      )}

      {/* Tournament details */}
      {selectedTournament && (
        <TournamentDetails tournament={selectedTournament} />
      )}
    </div>
  );
}
