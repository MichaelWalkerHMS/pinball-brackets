"use client";

import type { TournamentStatus, TournamentType } from "@/lib/types";

export interface SyncFilters {
  tournamentType: TournamentType | "all";
  status: TournamentStatus | "all";
}

interface BulkSyncFiltersProps {
  filters: SyncFilters;
  onChange: (filters: SyncFilters) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  confirmLabel: string;
}

const STATUS_OPTIONS: { value: TournamentStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "completed - results incomplete", label: "Completed - Results Incomplete" },
];

const TYPE_OPTIONS: { value: TournamentType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "open", label: "Open" },
  { value: "womens", label: "Women's" },
];

export default function BulkSyncFilters({
  filters,
  onChange,
  onConfirm,
  onCancel,
  title,
  confirmLabel,
}: BulkSyncFiltersProps) {
  return (
    <div className="mt-4 p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
      <h4 className="font-medium text-[rgb(var(--color-text-primary))] mb-4">{title}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Tournament Type */}
        <div>
          <label className="text-sm text-[rgb(var(--color-text-muted))] block mb-2">
            Tournament Type
          </label>
          <select
            value={filters.tournamentType}
            onChange={(e) =>
              onChange({ ...filters, tournamentType: e.target.value as TournamentType | "all" })
            }
            className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm text-[rgb(var(--color-text-muted))] block mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              onChange({ ...filters, status: e.target.value as TournamentStatus | "all" })
            }
            className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
