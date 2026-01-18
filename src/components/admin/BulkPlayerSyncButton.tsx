"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlayerDiff, MappedPlayer } from "@/lib/matchplay";
import BulkSyncFilters, { type SyncFilters } from "./BulkSyncFilters";

interface TournamentPreview {
  tournament: {
    id: string;
    name: string;
    matchplay_id: string;
  };
  players: MappedPlayer[];
  diff: PlayerDiff | null;
  hasChanges: boolean;
  bracketCount: number;
  existingCount: number;
  error?: string;
}

type Phase = "idle" | "selecting" | "fetching" | "reviewing" | "confirming" | "applying" | "complete";

interface ReviewDecision {
  tournamentId: string;
  tournamentName: string;
  accepted: boolean;
  players: MappedPlayer[];
}

interface ApplyResult {
  tournamentId: string;
  tournamentName: string;
  imported: number;
  error?: string;
}

const FETCH_DELAY_MS = 1500; // Delay between API calls to avoid rate limiting

export default function BulkPlayerSyncButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SyncFilters>({
    tournamentType: "all",
    status: "all",
  });

  // Fetching state
  const [allTournaments, setAllTournaments] = useState<TournamentPreview[]>([]);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // Reviewing state
  const [tournamentsToReview, setTournamentsToReview] = useState<TournamentPreview[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [decisions, setDecisions] = useState<ReviewDecision[]>([]);
  const [autoSkippedCount, setAutoSkippedCount] = useState(0);

  // Applying state
  const [applyResults, setApplyResults] = useState<ApplyResult[]>([]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStartSync = useCallback(() => {
    setPhase("selecting");
    setError(null);
  }, []);

  const handleCancelFilter = useCallback(() => {
    setPhase("idle");
  }, []);

  const startSync = useCallback(async () => {
    setPhase("fetching");
    setError(null);
    setAllTournaments([]);
    setDecisions([]);
    setAutoSkippedCount(0);

    // Build filter params
    const params = new URLSearchParams();
    if (filters.tournamentType !== "all") {
      params.set("tournamentType", filters.tournamentType);
    }
    if (filters.status !== "all") {
      params.set("status", filters.status);
    }
    const queryString = params.toString();
    const baseUrl = "/api/matchplay/bulk-players-preview";
    const listUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    try {
      // First, get list of all MP-linked tournaments (filtered)
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();

      if (!listResponse.ok) {
        setError(listData.error || "Failed to fetch tournament list");
        setPhase("idle");
        return;
      }

      const tournaments = listData.tournaments as TournamentPreview[];
      if (tournaments.length === 0) {
        setError("No tournaments with Match Play IDs found");
        setPhase("idle");
        return;
      }

      setFetchProgress({ current: 0, total: tournaments.length });

      // Fetch details for each tournament sequentially
      const fetchedTournaments: TournamentPreview[] = [];
      for (let i = 0; i < tournaments.length; i++) {
        const t = tournaments[i];
        setFetchProgress({ current: i + 1, total: tournaments.length });

        const response = await fetch(
          `/api/matchplay/bulk-players-preview?tournamentId=${t.tournament.id}`
        );
        const data = await response.json();

        if (response.ok && data.tournaments?.[0]) {
          fetchedTournaments.push(data.tournaments[0]);
        } else {
          fetchedTournaments.push({
            ...t,
            error: data.error || "Failed to fetch",
          });
        }

        // Delay before next request (except for last one)
        if (i < tournaments.length - 1) {
          await sleep(FETCH_DELAY_MS);
        }
      }

      setAllTournaments(fetchedTournaments);

      // Filter tournaments with changes for review
      const withChanges = fetchedTournaments.filter(
        (t) => t.hasChanges && !t.error && t.players.length > 0
      );
      const noChangesCount = fetchedTournaments.filter(
        (t) => !t.hasChanges && !t.error
      ).length;

      setAutoSkippedCount(noChangesCount);
      setTournamentsToReview(withChanges);
      setCurrentReviewIndex(0);

      if (withChanges.length === 0) {
        // Nothing to review, go straight to confirming (which will show summary)
        setPhase("confirming");
      } else {
        setPhase("reviewing");
      }
    } catch (err) {
      console.error("Error during sync:", err);
      setError("Failed to connect to server");
      setPhase("idle");
    }
  }, [filters]);

  const handleAccept = useCallback(() => {
    const current = tournamentsToReview[currentReviewIndex];
    setDecisions((prev) => [
      ...prev,
      {
        tournamentId: current.tournament.id,
        tournamentName: current.tournament.name,
        accepted: true,
        players: current.players,
      },
    ]);

    if (currentReviewIndex < tournamentsToReview.length - 1) {
      setCurrentReviewIndex((i) => i + 1);
    } else {
      setPhase("confirming");
    }
  }, [currentReviewIndex, tournamentsToReview]);

  const handleSkip = useCallback(() => {
    const current = tournamentsToReview[currentReviewIndex];
    setDecisions((prev) => [
      ...prev,
      {
        tournamentId: current.tournament.id,
        tournamentName: current.tournament.name,
        accepted: false,
        players: [],
      },
    ]);

    if (currentReviewIndex < tournamentsToReview.length - 1) {
      setCurrentReviewIndex((i) => i + 1);
    } else {
      setPhase("confirming");
    }
  }, [currentReviewIndex, tournamentsToReview]);

  const handleApplyAll = useCallback(async () => {
    const acceptedTournaments = decisions.filter((d) => d.accepted);
    if (acceptedTournaments.length === 0) {
      setPhase("complete");
      return;
    }

    setPhase("applying");
    setError(null);

    try {
      const response = await fetch("/api/matchplay/bulk-players-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournaments: acceptedTournaments.map((d) => ({
            tournamentId: d.tournamentId,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to apply changes");
        setPhase("confirming");
        return;
      }

      setApplyResults(data.tournaments);
      setPhase("complete");
      router.refresh();
    } catch (err) {
      console.error("Error applying changes:", err);
      setError("Failed to apply changes");
      setPhase("confirming");
    }
  }, [decisions, router]);

  const handleCancel = useCallback(() => {
    setPhase("idle");
    setError(null);
    setAllTournaments([]);
    setDecisions([]);
    setTournamentsToReview([]);
    setCurrentReviewIndex(0);
    setAutoSkippedCount(0);
    setApplyResults([]);
  }, []);

  const handleDone = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  // Calculate summary stats
  const acceptedCount = decisions.filter((d) => d.accepted).length;
  const manualSkippedCount = decisions.filter((d) => !d.accepted).length;
  const errorCount = allTournaments.filter((t) => t.error).length;

  return (
    <div className="p-4 bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-[rgb(var(--color-text-primary))]">
            Player Sync
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            Sync players for all tournaments linked to Match Play
          </p>
        </div>
        {phase === "idle" && (
          <button
            onClick={handleStartSync}
            className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Sync Players
          </button>
        )}
      </div>

      {/* Filter Selection Phase */}
      {phase === "selecting" && (
        <BulkSyncFilters
          filters={filters}
          onChange={setFilters}
          onConfirm={startSync}
          onCancel={handleCancelFilter}
          title="Select tournaments to sync players for"
          confirmLabel="Fetch Players"
        />
      )}

      {error && (
        <div className="mt-3 p-3 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}

      {/* Fetching Phase */}
      {phase === "fetching" && (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin text-[rgb(var(--color-accent-primary))]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[rgb(var(--color-text-secondary))]">
              Fetching tournament {fetchProgress.current} of {fetchProgress.total}...
            </span>
          </div>
          <div className="mt-2 h-2 bg-[rgb(var(--color-bg-tertiary))] rounded-full overflow-hidden">
            <div
              className="h-full bg-[rgb(var(--color-accent-primary))] transition-all duration-300"
              style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Reviewing Phase - Show MatchPlayDiff modal */}
      {phase === "reviewing" && tournamentsToReview[currentReviewIndex] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Progress indicator */}
            <div className="px-4 py-2 bg-[rgb(var(--color-bg-secondary))] border-b border-[rgb(var(--color-border-primary))]">
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Reviewing {currentReviewIndex + 1} of {tournamentsToReview.length} tournaments with changes
              </p>
            </div>

            {/* Tournament name */}
            <div className="px-4 py-3 border-b border-[rgb(var(--color-border-primary))]">
              <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
                {tournamentsToReview[currentReviewIndex].tournament.name}
              </h2>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-y-auto p-4">
              {tournamentsToReview[currentReviewIndex].diff ? (
                <DiffContent
                  diff={tournamentsToReview[currentReviewIndex].diff!}
                  bracketCount={tournamentsToReview[currentReviewIndex].bracketCount}
                />
              ) : (
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                  <p>
                    {tournamentsToReview[currentReviewIndex].existingCount === 0
                      ? `Fresh import: ${tournamentsToReview[currentReviewIndex].players.length} players`
                      : `Replacing ${tournamentsToReview[currentReviewIndex].existingCount} players with ${tournamentsToReview[currentReviewIndex].players.length} from Match Play`}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[rgb(var(--color-border-primary))] flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium"
              >
                Cancel All
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2 bg-[rgb(var(--color-warning-bg))] text-[rgb(var(--color-warning-text))] rounded-lg hover:opacity-90 font-medium"
              >
                Skip
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirming Phase - Summary before applying */}
      {phase === "confirming" && (
        <div className="mt-4 space-y-4">
          <h4 className="font-medium text-[rgb(var(--color-text-primary))]">Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-[rgb(var(--color-success-bg))] rounded-lg">
              <p className="font-medium text-[rgb(var(--color-success-text))]">
                {acceptedCount} accepted
              </p>
            </div>
            <div className="p-3 bg-[rgb(var(--color-warning-bg))] rounded-lg">
              <p className="font-medium text-[rgb(var(--color-warning-text))]">
                {manualSkippedCount} manually skipped
              </p>
            </div>
            <div className="p-3 bg-[rgb(var(--color-bg-tertiary))] rounded-lg">
              <p className="font-medium text-[rgb(var(--color-text-secondary))]">
                {autoSkippedCount} auto-skipped (no changes)
              </p>
            </div>
            {errorCount > 0 && (
              <div className="p-3 bg-[rgb(var(--color-error-bg-light))] rounded-lg">
                <p className="font-medium text-[rgb(var(--color-error-text))]">
                  {errorCount} errors
                </p>
              </div>
            )}
          </div>

          {acceptedCount > 0 && (
            <div className="p-3 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
              <p className="text-sm font-medium text-[rgb(var(--color-text-primary))] mb-2">
                Tournaments to update:
              </p>
              <ul className="text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
                {decisions
                  .filter((d) => d.accepted)
                  .map((d) => (
                    <li key={d.tournamentId}>{d.tournamentName}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium"
            >
              Cancel
            </button>
            {acceptedCount > 0 && (
              <button
                onClick={handleApplyAll}
                className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
              >
                Apply All ({acceptedCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Applying Phase */}
      {phase === "applying" && (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin text-[rgb(var(--color-accent-primary))]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[rgb(var(--color-text-secondary))]">
              Applying changes...
            </span>
          </div>
        </div>
      )}

      {/* Complete Phase */}
      {phase === "complete" && (
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-[rgb(var(--color-success-bg))] border border-[rgb(var(--color-success-border))] rounded-lg">
            <p className="font-medium text-[rgb(var(--color-success-text))]">
              Sync complete!
            </p>
          </div>

          {applyResults.length > 0 && (
            <ul className="text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
              {applyResults.map((r) => (
                <li key={r.tournamentId}>
                  {r.tournamentName}:{" "}
                  {r.error ? (
                    <span className="text-[rgb(var(--color-error-text))]">{r.error}</span>
                  ) : (
                    <span className="text-[rgb(var(--color-success-text))]">
                      {r.imported} players imported
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleDone}
              className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline diff content display (simplified version of MatchPlayDiff internals)
 */
function DiffContent({
  diff,
  bracketCount,
}: {
  diff: PlayerDiff;
  bracketCount: number;
}) {
  const totalChanges =
    diff.added.length + diff.removed.length + diff.reseeded.length + diff.renamed.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {totalChanges} change{totalChanges !== 1 ? "s" : ""} detected
      </p>

      {bracketCount > 0 && (
        <div className="p-3 bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg">
          <p className="text-sm text-[rgb(var(--color-warning-text))] font-medium">
            Warning: {bracketCount} bracket{bracketCount !== 1 ? "s" : ""} exist
          </p>
          <p className="text-xs text-[rgb(var(--color-warning-text))] mt-1">
            Seeding changes will affect how brackets are scored. These changes will be logged.
          </p>
        </div>
      )}

      {diff.added.length > 0 && (
        <DiffSection
          title="Added Players"
          type="added"
          items={diff.added.map((p) => `#${p.seed} ${p.name}`)}
        />
      )}

      {diff.removed.length > 0 && (
        <DiffSection
          title="Removed Players"
          type="removed"
          items={diff.removed.map((p) => `#${p.seed} ${p.name}`)}
        />
      )}

      {diff.reseeded.length > 0 && (
        <DiffSection
          title="Seed Changes"
          type="changed"
          items={diff.reseeded.map((p) => `${p.name}: #${p.oldSeed} → #${p.newSeed}`)}
        />
      )}

      {diff.renamed.length > 0 && (
        <DiffSection
          title="Name Changes"
          type="changed"
          items={diff.renamed.map((p) => `#${p.seed}: "${p.oldName}" → "${p.newName}"`)}
        />
      )}
    </div>
  );
}

function DiffSection({
  title,
  type,
  items,
}: {
  title: string;
  type: "added" | "removed" | "changed";
  items: string[];
}) {
  const colorClasses = {
    added: "text-[rgb(var(--color-success-text))]",
    removed: "text-[rgb(var(--color-error-text))]",
    changed: "text-[rgb(var(--color-warning-text))]",
  };

  const bgClasses = {
    added: "bg-[rgb(var(--color-success-bg-light))]",
    removed: "bg-[rgb(var(--color-error-bg-light))]",
    changed: "bg-[rgb(var(--color-warning-bg-light))]",
  };

  return (
    <div>
      <h3 className={`text-sm font-medium ${colorClasses[type]} mb-2`}>
        {title} ({items.length})
      </h3>
      <ul className={`${bgClasses[type]} rounded-lg p-3 space-y-1`}>
        {items.map((item, index) => (
          <li key={index} className="text-sm text-[rgb(var(--color-text-primary))]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
