"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Tournament, Player, Bracket, Pick, PlayerMap, Result } from "@/lib/types";
import { getPointsForRound } from "@/lib/scoring/calculateScore";
import {
  buildResultMap,
  computeAllActualParticipants,
  getMatchResultInfo,
} from "@/lib/bracket/actualParticipants";

// Get base URL for share links
function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
import {
  ROUNDS,
  ROUND_NAMES,
  MATCHES_PER_ROUND,
  OPENING_DISPLAY_ORDER,
  getPickKey,
} from "@/lib/bracket/constants";
import {
  getMatchWinner as getWinner,
  getMatchLoser as getLoser,
  getMatchParticipants as getParticipants,
  applyPick,
} from "@/lib/bracket/logic";
import Round from "./Round";
import FinalScoreInput from "./FinalScoreInput";
import BracketConnector from "./BracketConnector";
import { deleteBracket } from "@/app/tournament/[id]/actions";
import MatchPlayIndicator from "./MatchPlayIndicator";

interface BracketViewProps {
  tournament: Tournament;
  players: Player[];
  existingBracket: Bracket | null;
  existingPicks: Pick[];
  results?: Result[];
  isLocked: boolean;
  isLoggedIn: boolean;
  // Optional props for shared bracket view
  bracketName?: string | null;
  ownerName?: string;
  // Seeding change warning props
  affectedSeeds?: number[];
  seedingChangeCount?: number;
}

export default function BracketView({
  tournament,
  players,
  existingBracket,
  existingPicks,
  results = [],
  isLocked,
  isLoggedIn,
  bracketName,
  ownerName,
  affectedSeeds,
  seedingChangeCount,
}: BracketViewProps) {
  // Create player lookup map (seed -> Player)
  const playerMap: PlayerMap = new Map(players.map((p) => [p.seed, p]));

  // Initialize picks from existing data
  const initialPicks = new Map<string, number>();
  for (const pick of existingPicks) {
    initialPicks.set(getPickKey(pick.round, pick.match_position), pick.winner_seed);
  }

  const [picks, setPicks] = useState<Map<string, number>>(initialPicks);
  const [isPublic, setIsPublic] = useState(existingBracket?.is_public ?? true);
  const [editableBracketName, setEditableBracketName] = useState(existingBracket?.name || "");
  const [finalWinnerGames, setFinalWinnerGames] = useState<number | null>(
    existingBracket?.final_winner_games ?? null
  );
  const [finalLoserGames, setFinalLoserGames] = useState<number | null>(
    existingBracket?.final_loser_games ?? null
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Track bracket ID in state so it updates after first save
  const [bracketId, setBracketId] = useState<string | null>(existingBracket?.id ?? null);
  // Private explainer popup state
  const [showPrivateExplainer, setShowPrivateExplainer] = useState(false);
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // View mode toggle: 'results' shows result overlays, 'predictions' shows original picks
  const [viewMode, setViewMode] = useState<'results' | 'predictions'>('results');

  const router = useRouter();

  // Share URL (available when bracket is saved - uses state to update after first save)
  const shareUrl = bracketId
    ? `${getBaseUrl()}/bracket/${bracketId}`
    : null;

  // Check if we have any results to display (used for toggle visibility)
  const hasAnyResults = results.length > 0;

  // Build result map for looking up actual winners/losers
  const resultMap = useMemo(() => buildResultMap(results), [results]);

  // Compute actual participants for all matches based on cascading results
  const actualParticipantsMapFull = useMemo(
    () => computeAllActualParticipants(results, tournament.player_count as 16 | 24),
    [results, tournament.player_count]
  );

  // In predictions mode, use empty map to show original predictions without result overlays
  const actualParticipantsMap = viewMode === 'results' ? actualParticipantsMapFull : new Map();

  // Build a map of pick results from existingPicks for display
  // Combines pick info with result info for winner highlight and result bar
  const pickResultMapFull = useMemo(() => {
    const map = new Map<string, {
      isCorrect: boolean | null;
      pickedWinner: number;
      actualWinner: number | null;
      actualLoser: number | null;
    }>();
    for (const pick of existingPicks) {
      const key = `${pick.round}-${pick.match_position}`;
      const resultInfo = getMatchResultInfo(resultMap, pick.round, pick.match_position);
      map.set(key, {
        isCorrect: pick.is_correct,
        pickedWinner: pick.winner_seed,
        actualWinner: resultInfo?.winnerSeed ?? null,
        actualLoser: resultInfo?.loserSeed ?? null,
      });
    }
    return map;
  }, [existingPicks, resultMap]);

  // In predictions mode, use empty map to hide result overlays
  const pickResultMap = viewMode === 'results' ? pickResultMapFull : new Map();

  // For backwards compatibility with subtotal calculation (always use full map)
  const pickCorrectnessMap = useMemo(() => {
    const map = new Map<string, boolean | null>();
    for (const [key, value] of pickResultMapFull) {
      map.set(key, value.isCorrect);
    }
    return map;
  }, [pickResultMapFull]);

  // Calculate round subtotals (points earned / max) for each round
  const roundSubtotals = useMemo(() => {
    const subtotals: Record<number, { earned: number; max: number }> = {};
    const scoringConfig = tournament.scoring_config;
    const is16Player = tournament.player_count === 16;

    // Skip OPENING round for 16-player tournaments
    const rounds = is16Player
      ? [ROUNDS.ROUND_OF_16, ROUNDS.QUARTERS, ROUNDS.SEMIS, ROUNDS.FINALS, ROUNDS.CONSOLATION]
      : [ROUNDS.OPENING, ROUNDS.ROUND_OF_16, ROUNDS.QUARTERS, ROUNDS.SEMIS, ROUNDS.FINALS, ROUNDS.CONSOLATION];

    for (const round of rounds) {
      const matchCount = MATCHES_PER_ROUND[round] || 0;
      const pointsPerMatch = getPointsForRound(round, scoringConfig);
      const maxPoints = matchCount * pointsPerMatch;

      let earned = 0;
      for (let pos = 0; pos < matchCount; pos++) {
        const isCorrect = pickCorrectnessMap.get(`${round}-${pos}`);
        if (isCorrect === true) {
          earned += pointsPerMatch;
        }
      }

      subtotals[round] = { earned, max: maxPoints };
    }

    return subtotals;
  }, [pickCorrectnessMap, tournament.scoring_config, tournament.player_count]);

  const handleCopyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Wrapper functions that pass current picks state to pure logic functions
  const getMatchWinner = useCallback(
    (round: number, position: number): number | null => {
      return getWinner(picks, round, position);
    },
    [picks]
  );

  const getMatchLoser = useCallback(
    (round: number, position: number): number | null => {
      return getLoser(picks, round, position, tournament.player_count as 16 | 24);
    },
    [picks, tournament.player_count]
  );

  const getMatchParticipants = useCallback(
    (
      round: number,
      position: number
    ): { topSeed: number | null; bottomSeed: number | null } => {
      return getParticipants(picks, round, position, tournament.player_count as 16 | 24);
    },
    [picks, tournament.player_count]
  );

  // Handle picking a winner - uses pure logic function for cascade behavior
  const handlePick = useCallback(
    (round: number, position: number, winnerSeed: number) => {
      if (isLocked || !isLoggedIn) return;

      const newPicks = applyPick(picks, round, position, winnerSeed);
      setPicks(newPicks);
      setIsDirty(true);
      setSaveMessage(null);
    },
    [picks, isLocked, isLoggedIn]
  );

  // Build match data for each round (with display order for opening round)
  const buildRoundMatches = (round: number) => {
    const matches = [];
    const matchCount = MATCHES_PER_ROUND[round];

    for (let displayIdx = 0; displayIdx < matchCount; displayIdx++) {
      // For opening round, use display order; for other rounds, use sequential order
      const position = round === ROUNDS.OPENING
        ? OPENING_DISPLAY_ORDER[displayIdx]
        : displayIdx;

      const participants = getMatchParticipants(round, position);
      const winner = getMatchWinner(round, position);
      matches.push({
        position,
        topSeed: participants.topSeed,
        bottomSeed: participants.bottomSeed,
        winnerSeed: winner,
      });
    }
    return matches;
  };

  // Get champion (winner of finals) and runner-up (loser of finals)
  const champion = getMatchWinner(ROUNDS.FINALS, 0);
  const championPlayer = champion ? playerMap.get(champion) : null;
  const runnerUp = getMatchLoser(ROUNDS.FINALS, 0);
  const runnerUpPlayer = runnerUp ? playerMap.get(runnerUp) : null;

  // Handle final score change
  const handleFinalScoreChange = (winnerGames: number, loserGames: number) => {
    if (isLocked || !isLoggedIn) return;
    setFinalWinnerGames(winnerGames);
    setFinalLoserGames(loserGames);
    setIsDirty(true);
    setSaveMessage(null);
  };

  // Handle bracket deletion
  const handleDelete = async () => {
    if (!bracketId) return;
    setIsDeleting(true);
    const result = await deleteBracket(bracketId);
    if (result.error) {
      alert(result.error);
      setIsDeleting(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="w-full">
      {/* Seeding change warning banner */}
      {(seedingChangeCount ?? 0) > 0 && (
        <div className="bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-[rgb(var(--color-warning-icon))] text-lg">&#9888;</span>
          <span className="text-[rgb(var(--color-warning-text))]">
            Seeding changed {seedingChangeCount} {seedingChangeCount === 1 ? 'time' : 'times'} since you last saved. Review your picks.
          </span>
        </div>
      )}

      {/* Controls bar - only for logged in users */}
      {isLoggedIn && (
        <div className="mb-4 p-3 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            {/* Bracket name input - full width on mobile */}
            <input
              type="text"
              value={editableBracketName}
              onChange={(e) => {
                setEditableBracketName(e.target.value);
                setIsDirty(true);
                setSaveMessage(null);
              }}
              placeholder="Bracket name (optional)"
              maxLength={50}
              className="w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-md focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:border-[rgb(var(--color-accent-primary))] text-sm bg-[rgb(var(--color-bg-primary))]"
            />

            {/* Row 2 on mobile: Toggle + Save */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              {/* Public/Private toggle slider */}
              <div className="relative flex items-center gap-2 sm:gap-3">
                <span className="text-sm text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
                  {isPublic ? "Public" : "Private"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = !isPublic;
                    setIsPublic(newValue);
                    setIsDirty(true);
                    setSaveMessage(null);
                    if (!newValue) {
                      setShowPrivateExplainer(true);
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                    isPublic
                      ? "bg-[rgb(var(--color-accent-primary))]"
                      : "bg-[rgb(var(--color-border-secondary))]"
                  }`}
                  aria-label={isPublic ? "Make private" : "Make public"}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      isPublic ? "left-7" : "left-1"
                    }`}
                  />
                </button>

                {/* Private explainer popup */}
                {showPrivateExplainer && (
                  <>
                    {/* Backdrop to close on outside click */}
                    <div
                      className="fixed inset-0 z-40 sm:z-[5]"
                      onClick={() => setShowPrivateExplainer(false)}
                    />
                    <div className="fixed sm:absolute z-50 sm:z-10 left-4 right-4 sm:left-0 sm:right-auto top-1/2 sm:top-full -translate-y-1/2 sm:translate-y-0 sm:mt-2 w-auto sm:w-72 p-4 bg-[rgb(var(--color-bg-primary))] border border-[rgb(var(--color-border-primary))] rounded-lg shadow-lg">
                      <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-2">
                        <strong>Private brackets:</strong>
                      </p>
                      <ul className="text-sm text-[rgb(var(--color-text-secondary))] list-disc pl-4 space-y-1">
                        <li>Only visible to you</li>
                        <li>Won&apos;t appear on public leaderboard</li>
                        <li>You can make it public anytime</li>
                      </ul>
                      <button
                        onClick={() => setShowPrivateExplainer(false)}
                        className="mt-3 text-sm text-[rgb(var(--color-accent-primary))] hover:underline"
                      >
                        Got it
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Save button */}
              <button
                onClick={async () => {
                  setIsSaving(true);
                  setSaveMessage(null);

                  const { saveBracket } = await import(
                    "@/app/tournament/[id]/actions"
                  );

                  const picksArray = Array.from(picks.entries()).map(
                    ([key, winnerSeed]) => {
                      const [round, matchPosition] = key.split("-").map(Number);
                      return { round, matchPosition, winnerSeed };
                    }
                  );

                  const result = await saveBracket({
                    tournamentId: tournament.id,
                    bracketId: bracketId, // Use state which updates after first save
                    isPublic,
                    bracketName: editableBracketName.trim(),
                    picks: picksArray,
                    finalWinnerGames,
                    finalLoserGames,
                  });

                  setIsSaving(false);

                  if (result.error) {
                    setSaveMessage(`Error: ${result.error}`);
                  } else {
                    setSaveMessage("Saved!");
                    setIsDirty(false);
                    if (result.bracket?.id) {
                      setBracketId(result.bracket.id);
                    }
                  }
                }}
                disabled={isSaving}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${
                  isDirty
                    ? "bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))]"
                    : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-border-secondary))]"
                }`}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-2 sm:gap-3">
              <MatchPlayIndicator isLinked={!!tournament.matchplay_id} matchPlayId={tournament.matchplay_id} />

              {saveMessage && (
                <span
                  className={`text-sm ${
                    saveMessage.startsWith("Error")
                      ? "text-[rgb(var(--color-error-icon))]"
                      : "text-[rgb(var(--color-success-icon))]"
                  }`}
                >
                  {saveMessage}
                </span>
              )}

              {isLocked && (
                <span className="text-sm text-[rgb(var(--color-error-icon))]">Locked</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onKeyDown={(e) => e.key === "Escape" && setShowDeleteModal(false)}
        >
          <div className="bg-[rgb(var(--color-bg-primary))] p-6 rounded-lg max-w-md mx-4">
            <h3 id="delete-modal-title" className="text-lg font-bold mb-2">Delete Bracket?</h3>
            <p className="text-[rgb(var(--color-text-secondary))] mb-4">
              This will permanently delete your bracket and all predictions. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm border border-[rgb(var(--color-border-primary))] rounded-lg hover:bg-[rgb(var(--color-bg-secondary))]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View mode toggle - only show when there are results */}
      {hasAnyResults && (
        <div className="mb-4 p-3 bg-[rgb(var(--color-bg-secondary))] rounded-lg flex items-center justify-center gap-3">
          <span className={`text-sm ${viewMode === 'predictions' ? 'font-medium text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
            Original Predictions
          </span>
          <button
            type="button"
            onClick={() => setViewMode(v => v === 'results' ? 'predictions' : 'results')}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
              viewMode === 'results'
                ? "bg-[rgb(var(--color-accent-primary))]"
                : "bg-[rgb(var(--color-border-secondary))]"
            }`}
            aria-label={viewMode === 'results' ? 'Switch to original predictions view' : 'Switch to results view'}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                viewMode === 'results' ? "left-7" : "left-1"
              }`}
            />
          </button>
          <span className={`text-sm ${viewMode === 'results' ? 'font-medium text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
            With Results
          </span>
        </div>
      )}

      {/* Scroll hint - mobile only */}
      <div className="sm:hidden text-center text-sm text-[rgb(var(--color-text-muted))] mb-2 py-2 flex items-center justify-center gap-2 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Swipe to see all rounds</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </div>

      {/* Bracket container with horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-2 min-w-max items-start">
          {/* Opening Round - 24-player only */}
          {tournament.player_count === 24 && (
            <>
              <Round
                round={ROUNDS.OPENING}
                roundName={ROUND_NAMES[ROUNDS.OPENING]}
                matches={buildRoundMatches(ROUNDS.OPENING)}
                playerMap={playerMap}
                onPick={handlePick}
                isLocked={isLocked}
                isLoggedIn={isLoggedIn}
                affectedSeeds={affectedSeeds}
                pickResultMap={pickResultMap}
                actualParticipantsMap={actualParticipantsMap}
                subtotal={roundSubtotals[ROUNDS.OPENING]}
                hideSubtotal={viewMode === 'predictions'}
              />

              {/* Connector: Opening → R16 */}
              <BracketConnector
                sourceRound={ROUNDS.OPENING}
                sourceMatchCount={MATCHES_PER_ROUND[ROUNDS.OPENING]}
                destMatchCount={MATCHES_PER_ROUND[ROUNDS.ROUND_OF_16]}
              />
            </>
          )}

          {/* Round of 16 */}
          <Round
            round={ROUNDS.ROUND_OF_16}
            roundName={ROUND_NAMES[ROUNDS.ROUND_OF_16]}
            matches={buildRoundMatches(ROUNDS.ROUND_OF_16)}
            playerMap={playerMap}
            onPick={handlePick}
            isLocked={isLocked}
            isLoggedIn={isLoggedIn}
            affectedSeeds={affectedSeeds}
            pickResultMap={pickResultMap}
            actualParticipantsMap={actualParticipantsMap}
            subtotal={roundSubtotals[ROUNDS.ROUND_OF_16]}
            hideSubtotal={viewMode === 'predictions'}
          />

          {/* Connector: R16 → Quarters */}
          <BracketConnector
            sourceRound={ROUNDS.ROUND_OF_16}
            sourceMatchCount={MATCHES_PER_ROUND[ROUNDS.ROUND_OF_16]}
            destMatchCount={MATCHES_PER_ROUND[ROUNDS.QUARTERS]}
          />

          {/* Quarterfinals */}
          <Round
            round={ROUNDS.QUARTERS}
            roundName={ROUND_NAMES[ROUNDS.QUARTERS]}
            matches={buildRoundMatches(ROUNDS.QUARTERS)}
            playerMap={playerMap}
            onPick={handlePick}
            isLocked={isLocked}
            isLoggedIn={isLoggedIn}
            affectedSeeds={affectedSeeds}
            pickResultMap={pickResultMap}
            actualParticipantsMap={actualParticipantsMap}
            subtotal={roundSubtotals[ROUNDS.QUARTERS]}
            hideSubtotal={viewMode === 'predictions'}
          />

          <BracketConnector
            sourceRound={ROUNDS.QUARTERS}
            sourceMatchCount={MATCHES_PER_ROUND[ROUNDS.QUARTERS]}
            destMatchCount={MATCHES_PER_ROUND[ROUNDS.SEMIS]}
          />

          {/* Semifinals */}
          <Round
            round={ROUNDS.SEMIS}
            roundName={ROUND_NAMES[ROUNDS.SEMIS]}
            matches={buildRoundMatches(ROUNDS.SEMIS)}
            playerMap={playerMap}
            onPick={handlePick}
            isLocked={isLocked}
            isLoggedIn={isLoggedIn}
            affectedSeeds={affectedSeeds}
            pickResultMap={pickResultMap}
            actualParticipantsMap={actualParticipantsMap}
            subtotal={roundSubtotals[ROUNDS.SEMIS]}
            hideSubtotal={viewMode === 'predictions'}
          />

          <BracketConnector
            sourceRound={ROUNDS.SEMIS}
            sourceMatchCount={MATCHES_PER_ROUND[ROUNDS.SEMIS]}
            destMatchCount={MATCHES_PER_ROUND[ROUNDS.FINALS]}
          />

          {/* Finals + Champion */}
          <div className="flex flex-col">
            <Round
              round={ROUNDS.FINALS}
              roundName={ROUND_NAMES[ROUNDS.FINALS]}
              matches={buildRoundMatches(ROUNDS.FINALS)}
              playerMap={playerMap}
              onPick={handlePick}
              isLocked={isLocked}
              isLoggedIn={isLoggedIn}
              affectedSeeds={affectedSeeds}
              pickResultMap={pickResultMap}
              actualParticipantsMap={actualParticipantsMap}
              subtotal={roundSubtotals[ROUNDS.FINALS]}
              hideSubtotal={viewMode === 'predictions'}
            />

            {/* Champion display */}
            {championPlayer && (
              <div className="mt-4 p-3 bg-[rgb(var(--color-warning-bg))] border-2 border-[rgb(var(--color-warning-border))] rounded-lg text-center">
                <div className="text-xs text-[rgb(var(--color-warning-text))] font-medium">
                  CHAMPION
                </div>
                <div className="font-bold text-lg">{championPlayer.name}</div>
              </div>
            )}

            {/* Final score prediction */}
            {championPlayer && runnerUpPlayer && (
              <FinalScoreInput
                championName={championPlayer.name}
                runnerUpName={runnerUpPlayer.name}
                winnerGames={finalWinnerGames}
                loserGames={finalLoserGames}
                onScoreChange={handleFinalScoreChange}
                isLocked={isLocked}
                isLoggedIn={isLoggedIn}
              />
            )}

            {/* Consolation (3rd place) */}
            <div className="mt-8">
              <Round
                round={ROUNDS.CONSOLATION}
                roundName={ROUND_NAMES[ROUNDS.CONSOLATION]}
                matches={buildRoundMatches(ROUNDS.CONSOLATION)}
                playerMap={playerMap}
                onPick={handlePick}
                isLocked={isLocked}
                isLoggedIn={isLoggedIn}
                affectedSeeds={affectedSeeds}
                pickResultMap={pickResultMap}
                actualParticipantsMap={actualParticipantsMap}
                subtotal={roundSubtotals[ROUNDS.CONSOLATION]}
                hideSubtotal={viewMode === 'predictions'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Share URL - only for logged in users with saved brackets */}
      {isLoggedIn && bracketId && (
        <div className="mt-4 p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg max-w-md">
          <div className="text-sm font-medium mb-2">Share Your Bracket</div>
          {isPublic ? (
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl || ""}
                className="flex-1 px-3 py-2 border border-[rgb(var(--color-border-primary))] rounded-lg bg-[rgb(var(--color-bg-primary))] text-sm text-[rgb(var(--color-text-primary))]"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyUrl}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? "bg-[rgb(var(--color-success-icon))] text-white"
                    : "bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))]"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Make your bracket public to share it with others.
            </p>
          )}
        </div>
      )}

      {/* Delete button - at bottom of bracket */}
      {isLoggedIn && bracketId && (
        <div className="mt-4 max-w-md">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full px-4 py-2 text-sm text-[rgb(var(--color-error-icon))] hover:bg-[rgb(var(--color-error-bg))] rounded-lg transition-colors border border-[rgb(var(--color-error-border))]"
          >
            Delete Bracket
          </button>
        </div>
      )}
    </div>
  );
}
