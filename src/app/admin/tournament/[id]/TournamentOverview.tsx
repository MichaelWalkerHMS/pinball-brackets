"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tournament, TournamentFormData } from "@/lib/types";
import TournamentForm from "@/components/admin/TournamentForm";
import {
  updateTournament,
  updateTournamentStatus,
  toggleTournamentVisibility,
  deleteTournament,
} from "@/app/admin/actions";
import { manualRecalculateScores } from "./actions";

interface TournamentOverviewProps {
  tournament: Tournament;
  bracketCount: number;
}

export default function TournamentOverview({
  tournament,
  bracketCount,
}: TournamentOverviewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateSuccess, setRecalculateSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Format dates for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  async function handleUpdate(data: TournamentFormData) {
    const result = await updateTournament(tournament.id, data);
    if (result.error) {
      return { error: result.error };
    }
    setIsEditing(false);
    router.refresh();
    return {};
  }

  async function handleStatusChange(
    status: "upcoming" | "in_progress" | "completed"
  ) {
    setError(null);
    const result = await updateTournamentStatus(tournament.id, status);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleVisibilityToggle() {
    setError(null);
    const result = await toggleTournamentVisibility(tournament.id);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleRecalculateScores() {
    setIsRecalculating(true);
    setError(null);
    setRecalculateSuccess(null);

    const result = await manualRecalculateScores(tournament.id);
    if (result.error) {
      setError(result.error);
    } else {
      setRecalculateSuccess(`Recalculated scores for ${result.count} bracket(s)`);
      router.refresh();
    }
    setIsRecalculating(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this tournament? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const result = await deleteTournament(tournament.id);
    if (result.error) {
      setError(result.error);
      setIsDeleting(false);
    } else {
      router.push("/admin");
    }
  }

  if (isEditing) {
    return (
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">
          Edit Tournament
        </h2>
        <TournamentForm
          tournament={tournament}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))]">
          {error}
        </div>
      )}

      {recalculateSuccess && (
        <div className="p-4 bg-[rgb(var(--color-success-bg))] border border-[rgb(var(--color-success-icon))] rounded-lg text-[rgb(var(--color-success-text))]">
          {recalculateSuccess}
        </div>
      )}

      {/* Tournament Details */}
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">Details</h2>
          <button
            onClick={() => setIsEditing(true)}
            className="text-[rgb(var(--color-accent-primary))] hover:text-[rgb(var(--color-accent-hover))] text-sm font-medium"
          >
            Edit
          </button>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">State</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.state}</dd>
          </div>
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">Year</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.year}</dd>
          </div>
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">Player Count</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.player_count}</dd>
          </div>
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">Timezone</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.timezone}</dd>
          </div>
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">Start Date</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{formatDate(tournament.start_date)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[rgb(var(--color-text-muted))]">End Date</dt>
            <dd className="font-medium text-[rgb(var(--color-text-primary))]">{formatDate(tournament.end_date)}</dd>
          </div>
          {tournament.matchplay_id && (
            <div>
              <dt className="text-sm text-[rgb(var(--color-text-muted))]">MatchPlay ID</dt>
              <dd className="font-medium text-[rgb(var(--color-text-primary))]">{tournament.matchplay_id}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Status & Visibility Controls */}
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">
          Status & Visibility
        </h2>

        <div className="space-y-4">
          {/* Status */}
          <div>
            <label className="text-sm text-[rgb(var(--color-text-muted))] block mb-2">
              Tournament Status
            </label>
            <div className="flex gap-2">
              {(["upcoming", "in_progress", "completed"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      tournament.status === status
                        ? "bg-[rgb(var(--color-accent-primary))] text-white"
                        : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border-secondary))]"
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm text-[rgb(var(--color-text-muted))] block mb-2">
              Public Visibility
            </label>
            <button
              onClick={handleVisibilityToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tournament.is_active
                  ? "bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))] hover:opacity-80"
                  : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border-secondary))]"
              }`}
            >
              {tournament.is_active ? "Visible to Public" : "Hidden from Public"}
            </button>
          </div>

          {/* Recalculate Scores */}
          <div>
            <label className="text-sm text-[rgb(var(--color-text-muted))] block mb-2">
              Leaderboard Scores
            </label>
            <button
              onClick={handleRecalculateScores}
              disabled={isRecalculating || bracketCount === 0}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border-secondary))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRecalculating ? "Recalculating..." : "Recalculate All Scores"}
            </button>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
              Scores update automatically when results change. Use this only if scores appear incorrect.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-error-border))] p-6">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-error-icon))] mb-4">Danger Zone</h2>
        <p className="text-[rgb(var(--color-text-secondary))] text-sm mb-4">
          Deleting a tournament will remove all associated players. Brackets
          must be deleted separately first.
        </p>
        <button
          onClick={handleDelete}
          disabled={isDeleting || bracketCount > 0}
          className="px-4 py-2 bg-[rgb(var(--color-error-icon))] text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? "Deleting..." : "Delete Tournament"}
        </button>
        {bracketCount > 0 && (
          <p className="text-sm text-[rgb(var(--color-error-text))] mt-2">
            Cannot delete: {bracketCount} bracket(s) exist for this tournament.
          </p>
        )}
      </div>
    </div>
  );
}
