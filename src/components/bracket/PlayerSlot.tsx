"use client";

import type { PlayerMap } from "@/lib/types";

interface PlayerSlotProps {
  seed: number | null;
  playerMap: PlayerMap;
  isPicked: boolean; // User picked this player as winner
  isClickable: boolean;
  onClick: () => void;
  isAffected?: boolean;
  isActualWinner?: boolean; // This player actually won (from results)
  isUnexpectedWinner?: boolean; // This player won but user expected someone else entirely
  isUnexpectedParticipant?: boolean; // This player is here due to earlier result, but user expected someone else
  expectedSeed?: number | null; // Who the user expected in this slot (for showing "Expected X" message)
  isCorrect?: boolean | null; // undefined = not picked, null = no result yet, true/false = correct/incorrect
  needsTopAlign?: boolean; // Whether to top-align content (true when both result bar AND expected message exist)
}

export default function PlayerSlot({
  seed,
  playerMap,
  isPicked,
  isClickable,
  onClick,
  isAffected,
  isActualWinner,
  isUnexpectedWinner,
  isUnexpectedParticipant,
  expectedSeed,
  isCorrect,
  needsTopAlign,
}: PlayerSlotProps) {
  const player = seed !== null ? playerMap.get(seed) : null;

  if (seed === null) {
    // TBD slot - waiting for previous match result
    return (
      <div className="px-3 py-2 h-9 flex items-center text-[rgb(var(--color-text-muted))] text-sm italic bg-[rgb(var(--color-bg-secondary))]">
        TBD
      </div>
    );
  }

  // Background: dark charcoal if unexpected (winner or participant), green if expected winner, otherwise default
  const bgClass = isUnexpectedWinner || isUnexpectedParticipant
    ? "bg-[rgb(var(--color-unexpected-bg))]"
    : isActualWinner
    ? "bg-[rgb(var(--color-success-bg))]"
    : "bg-[rgb(var(--color-bg-primary))]";

  const baseClasses = `px-3 py-2 h-9 flex items-center gap-2 text-sm transition-colors ${bgClass} relative overflow-hidden`;
  const pickedClasses = isPicked ? "font-semibold" : "";
  const clickableClasses = isClickable
    ? "cursor-pointer hover:bg-[rgb(var(--color-accent-light))]"
    : "";

  // Determine pick indicator visibility and color
  // Green bar: picked and (no result yet OR correct) and expected participant
  // Red bar: picked and incorrect
  // Amber bar: picked but unexpected participant (user expected someone else in this slot)
  const showPickIndicator = isPicked;
  const pickIndicatorIsRed = isPicked && isCorrect === false;
  const pickIndicatorIsAmber = isPicked && isUnexpectedParticipant;

  // Get expected player name for "Expected X" display
  const expectedPlayer = expectedSeed !== null && expectedSeed !== undefined
    ? playerMap.get(expectedSeed)
    : null;
  const showExpectedMessage = isUnexpectedParticipant && expectedSeed !== null && expectedSeed !== undefined;

  // All slots have consistent height (h-14 = 56px) to maintain bracket alignment
  // Center player names by default
  // Only top-align when BOTH "Expected X" message AND result bar exist (need room for both)
  const slotClasses = needsTopAlign
    ? `${baseClasses} ${pickedClasses} ${clickableClasses} !h-14 flex-col !items-start justify-start !pt-2`
    : `${baseClasses} ${pickedClasses} ${clickableClasses} !h-14 flex-col !items-start justify-center`;

  return (
    <div
      className={slotClasses}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 w-full">
        <span className="text-[rgb(var(--color-text-muted))] font-mono text-xs w-5">
          {seed}
        </span>
        {isAffected && (
          <span className="text-[rgb(var(--color-warning-icon))] text-xs" title="Seeding changed">&#9888;</span>
        )}
        <span className="text-[rgb(var(--color-text-primary))]">
          {player?.name || `Seed ${seed}`}
        </span>
      </div>
      {/* Expected player message - only show/reserve space when top-align mode is active */}
      {needsTopAlign && (
        <div className={`text-xs h-4 w-full ${showExpectedMessage ? 'text-[rgb(var(--color-unexpected-text))]' : 'invisible'}`}>
          {showExpectedMessage ? `Expected ${expectedPlayer?.name || `Seed ${expectedSeed}`}` : '\u00A0'}
        </div>
      )}
      {/* Pick indicator - bar on right edge showing user's pick */}
      {showPickIndicator && (
        <span
          className={`absolute right-0 top-0 bottom-0 w-1 ${
            pickIndicatorIsRed
              ? "bg-[rgb(var(--color-error-icon))]"
              : pickIndicatorIsAmber
              ? "bg-[rgb(var(--color-unexpected-text))]"
              : "bg-[rgb(var(--color-pick-bg))]"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
