"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BulkSyncFilters, { type SyncFilters } from "./BulkSyncFilters";

interface TournamentSyncResult {
  tournamentId: string;
  tournamentName: string;
  imported: number;
  skipped: number;
  error?: string;
}

interface SyncResult {
  tournaments: TournamentSyncResult[];
  totalImported: number;
  totalSkipped: number;
}

type Phase = "idle" | "selecting" | "syncing";

export default function BulkSyncButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [filters, setFilters] = useState<SyncFilters>({
    tournamentType: "all",
    status: "all",
  });
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleStartSync() {
    setPhase("selecting");
    setError(null);
    setResult(null);
  }

  function handleCancelFilter() {
    setPhase("idle");
  }

  async function handleConfirmSync() {
    setPhase("syncing");
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (filters.tournamentType !== "all") {
        params.set("tournamentType", filters.tournamentType);
      }
      if (filters.status !== "all") {
        params.set("status", filters.status);
      }

      const response = await fetch(`/api/matchplay/bulk-results?${params.toString()}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to sync results");
        setPhase("idle");
      } else {
        setResult({
          tournaments: data.tournaments,
          totalImported: data.totalImported,
          totalSkipped: data.totalSkipped,
        });
        setPhase("idle");
        router.refresh();
      }
    } catch {
      setError("Failed to connect to server");
      setPhase("idle");
    }
  }

  const filterLabel =
    filters.tournamentType === "all" && filters.status === "all"
      ? "All"
      : [
          filters.tournamentType !== "all" && (filters.tournamentType === "womens" ? "Women's" : "Open"),
          filters.status !== "all" && filters.status.replace("_", " "),
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <div className="mb-6 p-4 bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-[rgb(var(--color-text-primary))]">
            Results Sync
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            Sync results for tournaments linked to Match Play
          </p>
        </div>
        {phase === "idle" && (
          <button
            onClick={handleStartSync}
            className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync Results
          </button>
        )}
        {phase === "syncing" && (
          <div className="flex items-center gap-2 text-[rgb(var(--color-text-secondary))]">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Syncing {filterLabel}...
          </div>
        )}
      </div>

      {/* Filter Selection Phase */}
      {phase === "selecting" && (
        <BulkSyncFilters
          filters={filters}
          onChange={setFilters}
          onConfirm={handleConfirmSync}
          onCancel={handleCancelFilter}
          title="Select tournaments to sync results for"
          confirmLabel="Sync Results"
        />
      )}

      {error && (
        <div className="mt-3 p-3 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 bg-[rgb(var(--color-success-bg))] border border-[rgb(var(--color-success-border))] rounded-lg text-sm">
          <p className="font-medium text-[rgb(var(--color-success-text))]">
            Imported {result.totalImported} result
            {result.totalImported !== 1 ? "s" : ""} across{" "}
            {result.tournaments.length} tournament
            {result.tournaments.length !== 1 ? "s" : ""}
          </p>
          {result.tournaments.length > 0 && (
            <ul className="mt-2 space-y-1 text-[rgb(var(--color-text-secondary))]">
              {result.tournaments.map((t) => (
                <li key={t.tournamentId}>
                  {t.tournamentName}: {t.imported} imported
                  {t.skipped > 0 && `, ${t.skipped} skipped`}
                  {t.error && (
                    <span className="text-[rgb(var(--color-error-text))]">
                      {" "}
                      - {t.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
