"use client";

import type { PlayerMap } from "@/lib/types";
import type { ActualParticipants } from "@/lib/bracket/actualParticipants";
import Match from "./Match";
import { ROUND_PADDING, ROUND_GAP, MATCH_GAP } from "@/lib/bracket/layout";

interface MatchData {
  position: number;
  topSeed: number | null;
  bottomSeed: number | null;
  winnerSeed: number | null;
}

// Pick result info for display purposes
export interface PickResultInfo {
  isCorrect: boolean | null;
  pickedWinner: number;
  actualWinner: number | null;
  actualLoser: number | null;
}

interface RoundProps {
  round: number;
  roundName: string;
  matches: MatchData[];
  playerMap: PlayerMap;
  onPick: (round: number, position: number, winnerSeed: number) => void;
  isLocked: boolean;
  isLoggedIn: boolean;
  affectedSeeds?: number[];
  pickResultMap?: Map<string, PickResultInfo>; // key: "round-position", value: pick result info
  actualParticipantsMap?: Map<string, ActualParticipants>; // key: "round-position", value: actual participants
  subtotal?: { earned: number; max: number }; // Points earned / max for this round
  hideSubtotal?: boolean; // Hide subtotal display (e.g., when viewing original predictions)
}

export default function Round({
  round,
  roundName,
  matches,
  playerMap,
  onPick,
  isLocked,
  isLoggedIn,
  affectedSeeds,
  pickResultMap,
  actualParticipantsMap,
  subtotal,
  hideSubtotal,
}: RoundProps) {
  // Get gap and padding from shared layout constants
  const getGapStyle = (): React.CSSProperties => {
    const gap = ROUND_GAP[round] ?? MATCH_GAP;
    return { gap: `${gap}px` };
  };

  const getPaddingStyle = (): React.CSSProperties => {
    const padding = ROUND_PADDING[round] ?? 0;
    return { paddingTop: `${padding}px` };
  };

  // Check if any picks in this round have been scored (isCorrect is not null)
  const hasAnyScored = pickResultMap && matches.some(m => {
    const key = `${round}-${m.position}`;
    const pickResult = pickResultMap.get(key);
    return pickResult?.isCorrect !== undefined && pickResult?.isCorrect !== null;
  });

  return (
    <div className="flex flex-col w-48">
      {/* Round header */}
      <div className="text-center mb-2 pb-2 border-b border-[rgb(var(--color-border-primary))]">
        <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{roundName}</h3>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
        {/* Round subtotal - only show when any picks have been scored and not hidden */}
        {hasAnyScored && subtotal && !hideSubtotal && (
          <p className="text-xs font-medium mt-1 text-[rgb(var(--color-text-secondary))]">
            {subtotal.earned}/{subtotal.max} pts
          </p>
        )}
      </div>

      {/* Matches container */}
      <div
        className="flex flex-col"
        style={{ ...getGapStyle(), ...getPaddingStyle() }}
      >
        {matches.map((match) => {
          const key = `${round}-${match.position}`;
          const actualParticipants = actualParticipantsMap?.get(key);
          return (
            <Match
              key={key}
              round={round}
              position={match.position}
              topSeed={match.topSeed}
              bottomSeed={match.bottomSeed}
              winnerSeed={match.winnerSeed}
              playerMap={playerMap}
              onPick={onPick}
              isLocked={isLocked}
              isLoggedIn={isLoggedIn}
              affectedSeeds={affectedSeeds}
              pickResultInfo={pickResultMap?.get(key)}
              actualTopSeed={actualParticipants?.actualTop}
              actualBottomSeed={actualParticipants?.actualBottom}
            />
          );
        })}
      </div>
    </div>
  );
}
