"use client";

import type { PlayerMap } from "@/lib/types";
import type { PickResultInfo } from "./Round";
import PlayerSlot from "./PlayerSlot";

interface MatchProps {
  round: number;
  position: number;
  topSeed: number | null; // User's expected top seed (based on their picks)
  bottomSeed: number | null; // User's expected bottom seed (based on their picks)
  winnerSeed: number | null; // User's picked winner for this match
  playerMap: PlayerMap;
  onPick: (round: number, position: number, winnerSeed: number) => void;
  isLocked: boolean;
  isLoggedIn: boolean;
  affectedSeeds?: number[];
  pickResultInfo?: PickResultInfo;
  actualTopSeed?: number | null; // Actual top seed from cascading results (null = TBD)
  actualBottomSeed?: number | null; // Actual bottom seed from cascading results (null = TBD)
}

export default function Match({
  round,
  position,
  topSeed,
  bottomSeed,
  winnerSeed,
  playerMap,
  onPick,
  isLocked,
  isLoggedIn,
  affectedSeeds,
  pickResultInfo,
  actualTopSeed,
  actualBottomSeed,
}: MatchProps) {
  const handlePickTop = () => {
    if (topSeed !== null) {
      onPick(round, position, topSeed);
    }
  };

  const handlePickBottom = () => {
    if (bottomSeed !== null) {
      onPick(round, position, bottomSeed);
    }
  };

  // Determine if actual participants differ from expected (cascading from earlier results)
  // actualTopSeed/actualBottomSeed come from cascading results
  // topSeed/bottomSeed are user's expected participants based on their picks
  const hasActualTop = actualTopSeed !== undefined && actualTopSeed !== null;
  const hasActualBottom = actualBottomSeed !== undefined && actualBottomSeed !== null;
  // Only mark as unexpected if user made a pick for the feeder match AND that pick differs from actual
  // If user hasn't picked (topSeed/bottomSeed is null), don't mark actual participant as unexpected
  const topIsUnexpected = hasActualTop && topSeed !== null && actualTopSeed !== topSeed;
  const bottomIsUnexpected = hasActualBottom && bottomSeed !== null && actualBottomSeed !== bottomSeed;

  // For display: show actual participants if we have results from feeders, otherwise show expected
  const displayTopSeed = hasActualTop ? actualTopSeed : topSeed;
  const displayBottomSeed = hasActualBottom ? actualBottomSeed : bottomSeed;

  // Check if this match involves any affected seeds (seeding changes warning)
  const isAffected = affectedSeeds?.some(
    (seed) => seed === displayTopSeed || seed === displayBottomSeed
  );

  // User's pick (who they selected as winner)
  const isTopPicked = winnerSeed === topSeed && topSeed !== null;
  const isBottomPicked = winnerSeed === bottomSeed && bottomSeed !== null;

  // Actual result info for THIS match (not feeders)
  const hasResult = pickResultInfo?.actualWinner !== null && pickResultInfo?.actualWinner !== undefined;
  const actualWinner = pickResultInfo?.actualWinner ?? null;
  const actualLoser = pickResultInfo?.actualLoser ?? null;
  const isCorrect = pickResultInfo?.isCorrect ?? null;
  const pickedWinner = pickResultInfo?.pickedWinner ?? null;

  // Determine result bar content
  let resultBarText: string | null = null;
  let resultBarColor: "green" | "red" | "orange" | null = null;
  let winnerWasUnexpected = false; // True if actual winner wasn't expected to be in this match

  if (hasResult && pickedWinner !== null) {
    if (isCorrect) {
      // User picked correctly
      resultBarText = "Correct pick!";
      resultBarColor = "green";
    } else if (pickedWinner === actualLoser) {
      // User picked someone who was in the match but lost
      const pickedPlayer = playerMap.get(pickedWinner);
      resultBarText = `You picked ${pickedPlayer?.name || `Seed ${pickedWinner}`}`;
      resultBarColor = "red";
    } else {
      // User picked someone who lost earlier and isn't in this match
      const pickedPlayer = playerMap.get(pickedWinner);
      resultBarText = `You picked ${pickedPlayer?.name || `Seed ${pickedWinner}`}`;
      resultBarColor = "red";
      winnerWasUnexpected = true;
    }
  }
  // Note: "Expected X" for unexpected participants (without result) is now shown
  // inline in each PlayerSlot, so we don't need a result bar for that case

  // Only top-align slots when there's BOTH a result bar AND at least one unexpected participant
  // (need room for both the "Expected X" message in slot AND the result bar below)
  const hasAnyUnexpectedParticipant = topIsUnexpected || bottomIsUnexpected;
  const needsTopAlign = hasResult && hasAnyUnexpectedParticipant;

  // Use rounded-t when result bar is visible, full rounded when no result
  const matchContainerClasses = hasResult
    ? `rounded-t-lg overflow-hidden bg-[rgb(var(--color-bg-primary))] shadow-sm ${
        isAffected ? 'border-2 border-b-0 border-[rgb(var(--color-warning-border))]' : 'border border-b-0 border-[rgb(var(--color-border-secondary))]'
      }`
    : `rounded-lg overflow-hidden bg-[rgb(var(--color-bg-primary))] shadow-sm ${
        isAffected ? 'border-2 border-[rgb(var(--color-warning-border))]' : 'border border-[rgb(var(--color-border-secondary))]'
      }`;

  return (
    <div className="flex flex-col">
      <div className={matchContainerClasses}>
        <PlayerSlot
          seed={displayTopSeed}
          playerMap={playerMap}
          isPicked={isTopPicked}
          isClickable={!isLocked && isLoggedIn && topSeed !== null}
          onClick={handlePickTop}
          isAffected={displayTopSeed !== null && affectedSeeds?.includes(displayTopSeed)}
          isActualWinner={hasResult && displayTopSeed === actualWinner}
          isUnexpectedWinner={hasResult && displayTopSeed === actualWinner && winnerWasUnexpected && topIsUnexpected}
          isUnexpectedParticipant={topIsUnexpected}
          expectedSeed={topIsUnexpected ? topSeed : undefined}
          isCorrect={isTopPicked ? isCorrect : undefined}
          needsTopAlign={needsTopAlign}
        />
        <div className="border-t border-[rgb(var(--color-border-primary))]" />
        <PlayerSlot
          seed={displayBottomSeed}
          playerMap={playerMap}
          isPicked={isBottomPicked}
          isClickable={!isLocked && isLoggedIn && bottomSeed !== null}
          onClick={handlePickBottom}
          isAffected={displayBottomSeed !== null && affectedSeeds?.includes(displayBottomSeed)}
          isActualWinner={hasResult && displayBottomSeed === actualWinner}
          isUnexpectedWinner={hasResult && displayBottomSeed === actualWinner && winnerWasUnexpected && bottomIsUnexpected}
          isUnexpectedParticipant={bottomIsUnexpected}
          expectedSeed={bottomIsUnexpected ? bottomSeed : undefined}
          isCorrect={isBottomPicked ? isCorrect : undefined}
          needsTopAlign={needsTopAlign}
        />
      </div>
      {/* Result bar - shows pick outcome after results are in */}
      {/* Always render container to maintain consistent height for bracket alignment */}
      <div className={`px-3 py-1 text-xs font-medium rounded-b-lg ${
        resultBarText
          ? resultBarColor === "green"
            ? "bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))] border border-t-0 border-[rgb(var(--color-border-secondary))]"
            : resultBarColor === "red"
            ? "bg-[rgb(var(--color-error-bg))] text-[rgb(var(--color-error-text))] border border-t-0 border-[rgb(var(--color-border-secondary))]"
            : "bg-[rgb(var(--color-warning-bg))] text-[rgb(var(--color-warning-text))] border border-t-0 border-[rgb(var(--color-border-secondary))]"
          : "invisible"
      }`}>
        {resultBarText || "\u00A0"} {/* Non-breaking space when empty to maintain height */}
      </div>
    </div>
  );
}
