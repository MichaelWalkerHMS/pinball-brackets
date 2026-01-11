"use client";

import { useState } from "react";
import type { Tournament, TournamentFormData } from "@/lib/types";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
];

interface TournamentFormProps {
  tournament?: Tournament; // If provided, we're editing
  onSubmit: (data: TournamentFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export default function TournamentForm({
  tournament,
  onSubmit,
  onCancel,
}: TournamentFormProps) {
  const isEditing = !!tournament;

  // Initialize form state
  const [formData, setFormData] = useState<TournamentFormData>({
    name: tournament?.name || "",
    state: tournament?.state || "Michigan",
    year: tournament?.year || new Date().getFullYear(),
    lock_date: tournament?.lock_date
      ? formatDateTimeLocal(tournament.lock_date)
      : "",
    start_date: tournament?.start_date
      ? formatDateTimeLocal(tournament.start_date)
      : "",
    end_date: tournament?.end_date
      ? formatDateTimeLocal(tournament.end_date)
      : "",
    player_count: (tournament?.player_count as 16 | 24) || 24,
    timezone: tournament?.timezone || "America/New_York",
    matchplay_id: tournament?.matchplay_id || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingFromMP, setIsFetchingFromMP] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDateTimeLocal(isoString: string): string {
    const date = new Date(isoString);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  async function handleFetchFromMatchPlay() {
    if (!formData.matchplay_id) {
      setError("Please enter a Match Play ID first");
      return;
    }

    setIsFetchingFromMP(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/matchplay/tournament?id=${encodeURIComponent(formData.matchplay_id)}`
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to fetch from Match Play");
        return;
      }

      // Pre-fill form with fetched data
      const mpData = result.data;
      setFormData((prev) => ({
        ...prev,
        name: mpData.name || prev.name,
        start_date: mpData.start_date ? formatDateTimeLocal(mpData.start_date) : prev.start_date,
        end_date: mpData.end_date ? formatDateTimeLocal(mpData.end_date) : prev.end_date,
      }));
    } catch (err) {
      console.error("Error fetching from Match Play:", err);
      setError("Failed to connect to Match Play");
    } finally {
      setIsFetchingFromMP(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(formData);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))]">
          {error}
        </div>
      )}

      {/* Tournament Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
        >
          Tournament Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
          placeholder="2026 Michigan State Championship"
          required
        />
      </div>

      {/* State and Year */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="state"
            className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
          >
            State
          </label>
          <select
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            required
          >
            <option value="">Select State...</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="year"
            className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
          >
            Year
          </label>
          <input
            type="number"
            id="year"
            value={formData.year}
            onChange={(e) =>
              setFormData({ ...formData, year: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            min={2020}
            max={2030}
            required
          />
        </div>
      </div>

      {/* Player Count */}
      <div>
        <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">
          Player Count
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-[rgb(var(--color-text-primary))]">
            <input
              type="radio"
              name="player_count"
              value={24}
              checked={formData.player_count === 24}
              onChange={() => setFormData({ ...formData, player_count: 24 })}
              className="w-4 h-4"
            />
            <span>24 players</span>
          </label>
          <label className="flex items-center gap-2 text-[rgb(var(--color-text-primary))]">
            <input
              type="radio"
              name="player_count"
              value={16}
              checked={formData.player_count === 16}
              onChange={() => setFormData({ ...formData, player_count: 16 })}
              className="w-4 h-4"
            />
            <span>16 players</span>
          </label>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
          Max points: {formData.player_count === 16 ? "29" : "53"}
        </p>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="lock_date"
            className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
          >
            Predictions Lock
          </label>
          <input
            type="datetime-local"
            id="lock_date"
            value={formData.lock_date}
            onChange={(e) =>
              setFormData({ ...formData, lock_date: e.target.value })
            }
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            required
          />
        </div>
        <div>
          <label
            htmlFor="start_date"
            className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
          >
            Start Date
          </label>
          <input
            type="datetime-local"
            id="start_date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            required
          />
        </div>
        <div>
          <label
            htmlFor="end_date"
            className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
          >
            End Date
          </label>
          <input
            type="datetime-local"
            id="end_date"
            value={formData.end_date}
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
            className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            required
          />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label
          htmlFor="timezone"
          className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
        >
          Timezone
        </label>
        <select
          id="timezone"
          value={formData.timezone}
          onChange={(e) =>
            setFormData({ ...formData, timezone: e.target.value })
          }
          className="w-full px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
        >
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
        </select>
      </div>

      {/* MatchPlay ID (optional) */}
      <div>
        <label
          htmlFor="matchplay_id"
          className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
        >
          MatchPlay ID{" "}
          <span className="text-[rgb(var(--color-text-muted))] font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="matchplay_id"
            value={formData.matchplay_id}
            onChange={(e) =>
              setFormData({ ...formData, matchplay_id: e.target.value })
            }
            className="flex-1 px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
            placeholder="e.g., 12345"
          />
          <button
            type="button"
            onClick={handleFetchFromMatchPlay}
            disabled={isFetchingFromMP || !formData.matchplay_id}
            className="px-3 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isFetchingFromMP ? "Fetching..." : "Fetch from MP"}
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
          Enter the Match Play tournament ID to auto-fill name and dates
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? "Saving..."
            : isEditing
              ? "Save Changes"
              : "Create Tournament"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
