"use client";

import type { PlayerDiff } from "@/lib/matchplay";

interface MatchPlayDiffProps {
  diff: PlayerDiff;
  bracketCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

/**
 * Modal component for displaying Match Play player diff and confirming changes
 */
export default function MatchPlayDiff({
  diff,
  bracketCount,
  onConfirm,
  onCancel,
  isApplying,
}: MatchPlayDiffProps) {
  const totalChanges =
    diff.added.length +
    diff.removed.length +
    diff.reseeded.length +
    diff.renamed.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[rgb(var(--color-border-primary))]">
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
            Confirm Player Changes
          </h2>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            {totalChanges} change{totalChanges !== 1 ? "s" : ""} detected from
            Match Play
          </p>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Warning if brackets exist */}
          {bracketCount > 0 && (
            <div className="p-3 bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg">
              <p className="text-sm text-[rgb(var(--color-warning-text))] font-medium">
                Warning: {bracketCount} bracket{bracketCount !== 1 ? "s" : ""}{" "}
                exist{bracketCount === 1 ? "s" : ""} for this tournament
              </p>
              <p className="text-xs text-[rgb(var(--color-warning-text))] mt-1">
                Seeding changes will affect how brackets are scored. These
                changes will be logged.
              </p>
            </div>
          )}

          {/* Added Players */}
          {diff.added.length > 0 && (
            <DiffSection
              title="Added Players"
              type="added"
              items={diff.added.map((p) => `#${p.seed} ${p.name}`)}
            />
          )}

          {/* Removed Players */}
          {diff.removed.length > 0 && (
            <DiffSection
              title="Removed Players"
              type="removed"
              items={diff.removed.map((p) => `#${p.seed} ${p.name}`)}
            />
          )}

          {/* Reseeded Players */}
          {diff.reseeded.length > 0 && (
            <DiffSection
              title="Seed Changes"
              type="changed"
              items={diff.reseeded.map(
                (p) => `${p.name}: #${p.oldSeed} → #${p.newSeed}`
              )}
            />
          )}

          {/* Renamed Players */}
          {diff.renamed.length > 0 && (
            <DiffSection
              title="Name Changes"
              type="changed"
              items={diff.renamed.map(
                (p) => `#${p.seed}: "${p.oldName}" → "${p.newName}"`
              )}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgb(var(--color-border-primary))] flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isApplying}
            className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium disabled:opacity-50"
          >
            {isApplying ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </div>
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

  const iconPaths = {
    added: "M12 4v16m8-8H4",
    removed: "M20 12H4",
    changed: "M7 8l5 5 5-5M7 16l5-5 5 5",
  };

  return (
    <div>
      <h3 className={`text-sm font-medium ${colorClasses[type]} mb-2`}>
        {title} ({items.length})
      </h3>
      <ul className={`${bgClasses[type]} rounded-lg p-3 space-y-1`}>
        {items.map((item, index) => (
          <li key={index} className="text-sm text-[rgb(var(--color-text-primary))] flex items-center gap-2">
            <svg
              className={`w-4 h-4 ${colorClasses[type]} shrink-0`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={iconPaths[type]}
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
