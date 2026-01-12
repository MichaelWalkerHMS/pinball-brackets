"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Tournament, Player, Result } from "@/lib/types";
import {
  ROUNDS,
  ROUND_NAMES,
  MATCHES_PER_ROUND,
  OPENING_ROUND_MATCHES,
  ROUND_OF_16_MATCHES,
  ROUND_OF_16_MATCHES_16P,
  QUARTERS_MATCHES,
  SEMIS_MATCHES,
  FINALS_MATCH,
  CONSOLATION_MATCH,
  getPickKey,
} from "@/lib/bracket/constants";
import { saveResult, deleteResult, clearDownstreamResults, clearAllResults } from "./actions";

interface ResultsEntryProps {
  tournament: Tournament;
  players: Player[];
  results: Result[];
}

interface SyncResult {
  imported: number;
  skipped: number;
  byRound: Record<string, number>;
}

export default function ResultsEntry({
  tournament,
  players,
  results: initialResults,
}: ResultsEntryProps) {
  const router = useRouter();
  const [results, setResults] = useState(initialResults);
  // Default to first available round (OPENING for 24-player, R16 for 16-player)
  const [activeRound, setActiveRound] = useState<number>(
    tournament.player_count === 16 ? ROUNDS.ROUND_OF_16 : ROUNDS.OPENING
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [clearing, setClearing] = useState(false);

  const hasMatchPlayId = !!tournament.matchplay_id;
  const hasResults = results.length > 0;

  async function handleSyncFromMatchPlay() {
    if (!hasMatchPlayId || syncing) return;

    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch('/api/matchplay/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to sync results');
      } else {
        setSyncResult({
          imported: data.imported,
          skipped: data.skipped,
          byRound: data.byRound,
        });
        // Full page reload to show updated results
        window.location.reload();
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearAllResults() {
    if (clearing || !hasResults) return;

    const confirmed = confirm(
      `Are you sure you want to clear all ${results.length} results? This action cannot be undone.`
    );
    if (!confirmed) return;

    setClearing(true);
    setError(null);

    try {
      const result = await clearAllResults(tournament.id);

      if (result.error) {
        setError(result.error);
      } else {
        // Clear local state
        setResults([]);
        router.refresh();
      }
    } catch {
      setError('Failed to clear results');
    } finally {
      setClearing(false);
    }
  }

  // Create a map for quick player lookup
  const playerMap = useMemo(() => {
    const map = new Map<number, Player>();
    players.forEach((p) => map.set(p.seed, p));
    return map;
  }, [players]);

  // Create a map for quick result lookup
  const resultMap = useMemo(() => {
    const map = new Map<string, Result>();
    results.forEach((r) => map.set(getPickKey(r.round, r.match_position), r));
    return map;
  }, [results]);

  // Get the winner of a match from results
  function getResultWinner(round: number, position: number): number | null {
    const result = resultMap.get(getPickKey(round, position));
    return result?.winner_seed ?? null;
  }

  // Get the loser of a match from results
  function getResultLoser(round: number, position: number): number | null {
    const result = resultMap.get(getPickKey(round, position));
    return result?.loser_seed ?? null;
  }

  // Get participants for a match based on round and position
  function getMatchParticipants(
    round: number,
    position: number
  ): { topSeed: number | null; bottomSeed: number | null } {
    switch (round) {
      case ROUNDS.OPENING: {
        // 16-player tournaments have no opening round
        if (tournament.player_count === 16) {
          return { topSeed: null, bottomSeed: null };
        }
        const match = OPENING_ROUND_MATCHES[position];
        return { topSeed: match.topSeed, bottomSeed: match.bottomSeed };
      }

      case ROUNDS.ROUND_OF_16: {
        // 16-player: direct seed pairings
        if (tournament.player_count === 16) {
          const match = ROUND_OF_16_MATCHES_16P[position];
          return { topSeed: match.topSeed, bottomSeed: match.bottomSeed };
        }
        // 24-player: bye seed + opening round winner
        const match = ROUND_OF_16_MATCHES[position];
        const openingWinner = getResultWinner(
          ROUNDS.OPENING,
          match.openingWinnerPosition
        );
        return { topSeed: match.byeSeed, bottomSeed: openingWinner };
      }

      case ROUNDS.QUARTERS: {
        const match = QUARTERS_MATCHES[position];
        const topWinner = getResultWinner(
          ROUNDS.ROUND_OF_16,
          match.topSourcePosition
        );
        const bottomWinner = getResultWinner(
          ROUNDS.ROUND_OF_16,
          match.bottomSourcePosition
        );
        return { topSeed: topWinner, bottomSeed: bottomWinner };
      }

      case ROUNDS.SEMIS: {
        const match = SEMIS_MATCHES[position];
        const topWinner = getResultWinner(
          ROUNDS.QUARTERS,
          match.topSourcePosition
        );
        const bottomWinner = getResultWinner(
          ROUNDS.QUARTERS,
          match.bottomSourcePosition
        );
        return { topSeed: topWinner, bottomSeed: bottomWinner };
      }

      case ROUNDS.FINALS: {
        const topWinner = getResultWinner(
          ROUNDS.SEMIS,
          FINALS_MATCH.topSourcePosition
        );
        const bottomWinner = getResultWinner(
          ROUNDS.SEMIS,
          FINALS_MATCH.bottomSourcePosition
        );
        return { topSeed: topWinner, bottomSeed: bottomWinner };
      }

      case ROUNDS.CONSOLATION: {
        const topLoser = getResultLoser(
          ROUNDS.SEMIS,
          CONSOLATION_MATCH.topSourcePosition
        );
        const bottomLoser = getResultLoser(
          ROUNDS.SEMIS,
          CONSOLATION_MATCH.bottomSourcePosition
        );
        return { topSeed: topLoser, bottomSeed: bottomLoser };
      }

      default:
        return { topSeed: null, bottomSeed: null };
    }
  }

  // Get player name by seed
  function getPlayerName(seed: number | null): string {
    if (seed === null) return "TBD";
    const player = playerMap.get(seed);
    return player?.name ?? `Seed ${seed}`;
  }

  // Check if any downstream results exist
  function hasDownstreamResults(round: number): boolean {
    return results.some((r) => r.round > round);
  }

  // Handle saving a result
  async function handleSaveResult(
    position: number,
    winnerSeed: number,
    loserSeed: number,
    winnerGames?: number,
    loserGames?: number
  ) {
    const key = getPickKey(activeRound, position);
    setSaving(key);
    setError(null);

    // Check if there are downstream results that need clearing
    if (hasDownstreamResults(activeRound)) {
      const confirmed = confirm(
        "Changing this result will clear all results in later rounds. Continue?"
      );
      if (!confirmed) {
        setSaving(null);
        return;
      }
      // Clear downstream results
      const clearResult = await clearDownstreamResults(
        tournament.id,
        activeRound
      );
      if (clearResult.error) {
        setError(clearResult.error);
        setSaving(null);
        return;
      }
      // Update local state to remove downstream results
      setResults((prev) => prev.filter((r) => r.round <= activeRound));
    }

    const result = await saveResult(
      tournament.id,
      activeRound,
      position,
      winnerSeed,
      loserSeed,
      winnerGames,
      loserGames
    );

    if (result.error) {
      setError(result.error);
    } else {
      // Update local state
      setResults((prev) => {
        const filtered = prev.filter(
          (r) => !(r.round === activeRound && r.match_position === position)
        );
        return [
          ...filtered,
          {
            id: crypto.randomUUID(),
            tournament_id: tournament.id,
            round: activeRound,
            match_position: position,
            winner_seed: winnerSeed,
            loser_seed: loserSeed,
            winner_games: winnerGames ?? 0,
            loser_games: loserGames ?? 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
    }

    setSaving(null);
  }

  // Handle deleting a result
  async function handleDeleteResult(position: number) {
    const key = getPickKey(activeRound, position);

    // Check if there are downstream results
    if (hasDownstreamResults(activeRound)) {
      const confirmed = confirm(
        "Deleting this result will also clear all results in later rounds. Continue?"
      );
      if (!confirmed) return;

      const clearResult = await clearDownstreamResults(
        tournament.id,
        activeRound
      );
      if (clearResult.error) {
        setError(clearResult.error);
        return;
      }
      setResults((prev) => prev.filter((r) => r.round <= activeRound));
    }

    setSaving(key);
    setError(null);

    const result = await deleteResult(tournament.id, activeRound, position);

    if (result.error) {
      setError(result.error);
    } else {
      setResults((prev) =>
        prev.filter(
          (r) => !(r.round === activeRound && r.match_position === position)
        )
      );
    }

    setSaving(null);
  }

  // Get rounds to display (based on player count)
  const rounds =
    tournament.player_count === 24
      ? [
          ROUNDS.OPENING,
          ROUNDS.ROUND_OF_16,
          ROUNDS.QUARTERS,
          ROUNDS.SEMIS,
          ROUNDS.FINALS,
          ROUNDS.CONSOLATION,
        ]
      : [
          ROUNDS.ROUND_OF_16,
          ROUNDS.QUARTERS,
          ROUNDS.SEMIS,
          ROUNDS.FINALS,
          ROUNDS.CONSOLATION,
        ];

  // Count completed matches per round
  function getCompletedCount(round: number): number {
    return results.filter((r) => r.round === round).length;
  }

  return (
    <div className="space-y-6">
      {/* Match Play Sync & Clear All */}
      <div className="flex items-center gap-4 p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg border border-[rgb(var(--color-border-primary))]">
        <div className="flex-1">
          {hasMatchPlayId ? (
            <>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Sync results from Match Play Events
              </p>
              {syncResult && (
                <p className="text-sm text-[rgb(var(--color-success-text))] mt-1">
                  Imported {syncResult.imported} result{syncResult.imported !== 1 ? 's' : ''}
                  {syncResult.skipped > 0 && ` (${syncResult.skipped} skipped)`}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              Results management
            </p>
          )}
        </div>
        {hasMatchPlayId && (
          <button
            onClick={handleSyncFromMatchPlay}
            disabled={syncing}
            className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync from Match Play
              </>
            )}
          </button>
        )}
        {hasResults && (
          <button
            onClick={handleClearAllResults}
            disabled={clearing}
            className="px-4 py-2 bg-[rgb(var(--color-error-bg))] text-[rgb(var(--color-error-text))] rounded-lg hover:bg-[rgb(var(--color-error-bg-light))] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-[rgb(var(--color-error-border))]"
          >
            {clearing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Clearing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All Results
              </>
            )}
          </button>
        )}
      </div>

      {/* Round selector */}
      <div className="flex flex-wrap gap-2">
        {rounds.map((round) => {
          const total = MATCHES_PER_ROUND[round];
          const completed = getCompletedCount(round);
          const isComplete = completed === total;

          return (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeRound === round
                  ? "bg-[rgb(var(--color-accent-primary))] text-white"
                  : isComplete
                    ? "bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))] hover:opacity-80"
                    : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border-secondary))]"
              }`}
            >
              {ROUND_NAMES[round]}
              <span className="ml-2 text-xs opacity-75">
                ({completed}/{total})
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}

      {/* Matches for selected round */}
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] overflow-hidden">
        <div className="p-4 bg-[rgb(var(--color-bg-secondary))] border-b border-[rgb(var(--color-border-primary))]">
          <h3 className="font-semibold text-[rgb(var(--color-text-primary))]">
            {ROUND_NAMES[activeRound]}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            Select the winner for each match.{" "}
            {activeRound === ROUNDS.FINALS && "Enter game scores for the final."}
          </p>
        </div>

        <div className="divide-y divide-[rgb(var(--color-border-primary))]">
          {Array.from({ length: MATCHES_PER_ROUND[activeRound] }).map(
            (_, position) => (
              <MatchResultInput
                key={position}
                position={position}
                round={activeRound}
                participants={getMatchParticipants(activeRound, position)}
                existingResult={resultMap.get(
                  getPickKey(activeRound, position)
                )}
                getPlayerName={getPlayerName}
                onSave={handleSaveResult}
                onDelete={handleDeleteResult}
                isSaving={saving === getPickKey(activeRound, position)}
                isFinal={activeRound === ROUNDS.FINALS}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

interface MatchResultInputProps {
  position: number;
  round: number;
  participants: { topSeed: number | null; bottomSeed: number | null };
  existingResult?: Result;
  getPlayerName: (seed: number | null) => string;
  onSave: (
    position: number,
    winnerSeed: number,
    loserSeed: number,
    winnerGames?: number,
    loserGames?: number
  ) => void;
  onDelete: (position: number) => void;
  isSaving: boolean;
  isFinal: boolean;
}

function MatchResultInput({
  position,
  participants,
  existingResult,
  getPlayerName,
  onSave,
  onDelete,
  isSaving,
  isFinal,
}: MatchResultInputProps) {
  const { topSeed, bottomSeed } = participants;
  const [winnerGames, setWinnerGames] = useState<number | undefined>(
    existingResult?.winner_games
  );
  const [loserGames, setLoserGames] = useState<number | undefined>(
    existingResult?.loser_games
  );

  const canEnterResult = topSeed !== null && bottomSeed !== null;
  const hasResult = existingResult !== undefined;

  function handleSelectWinner(winnerSeed: number) {
    if (!canEnterResult || isSaving) return;

    const loserSeed = winnerSeed === topSeed ? bottomSeed! : topSeed!;
    onSave(position, winnerSeed, loserSeed, winnerGames, loserGames);
  }

  function handleUpdateScores() {
    if (!existingResult || isSaving) return;
    onSave(
      position,
      existingResult.winner_seed,
      existingResult.loser_seed,
      winnerGames,
      loserGames
    );
  }

  return (
    <div className={`p-4 ${!canEnterResult ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-4">
        {/* Match number */}
        <span className="w-8 text-center text-sm font-mono text-[rgb(var(--color-text-muted))]">
          #{position + 1}
        </span>

        {/* Participants */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {/* Top seed */}
          <button
            onClick={() => topSeed && handleSelectWinner(topSeed)}
            disabled={!canEnterResult || isSaving}
            className={`p-3 rounded-lg border text-left transition-colors ${
              existingResult?.winner_seed === topSeed
                ? "bg-[rgb(var(--color-success-bg))] border-[rgb(var(--color-success-icon))] text-[rgb(var(--color-success-text))]"
                : canEnterResult
                  ? "bg-[rgb(var(--color-bg-primary))] border-[rgb(var(--color-border-primary))] hover:border-[rgb(var(--color-accent-primary))] hover:bg-[rgb(var(--color-accent-light))]"
                  : "bg-[rgb(var(--color-bg-secondary))] border-[rgb(var(--color-border-primary))] cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-2">
              {topSeed && (
                <span className="text-xs font-mono text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 rounded">
                  {topSeed}
                </span>
              )}
              <span className="font-medium text-[rgb(var(--color-text-primary))]">{getPlayerName(topSeed)}</span>
              {existingResult?.winner_seed === topSeed && (
                <span className="ml-auto text-[rgb(var(--color-success-icon))]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>
          </button>

          {/* Bottom seed */}
          <button
            onClick={() => bottomSeed && handleSelectWinner(bottomSeed)}
            disabled={!canEnterResult || isSaving}
            className={`p-3 rounded-lg border text-left transition-colors ${
              existingResult?.winner_seed === bottomSeed
                ? "bg-[rgb(var(--color-success-bg))] border-[rgb(var(--color-success-icon))] text-[rgb(var(--color-success-text))]"
                : canEnterResult
                  ? "bg-[rgb(var(--color-bg-primary))] border-[rgb(var(--color-border-primary))] hover:border-[rgb(var(--color-accent-primary))] hover:bg-[rgb(var(--color-accent-light))]"
                  : "bg-[rgb(var(--color-bg-secondary))] border-[rgb(var(--color-border-primary))] cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-2">
              {bottomSeed && (
                <span className="text-xs font-mono text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 rounded">
                  {bottomSeed}
                </span>
              )}
              <span className="font-medium text-[rgb(var(--color-text-primary))]">{getPlayerName(bottomSeed)}</span>
              {existingResult?.winner_seed === bottomSeed && (
                <span className="ml-auto text-[rgb(var(--color-success-icon))]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Game scores (for finals) */}
        {isFinal && hasResult && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="4"
              value={winnerGames ?? ""}
              onChange={(e) =>
                setWinnerGames(e.target.value ? parseInt(e.target.value) : undefined)
              }
              onBlur={handleUpdateScores}
              className="w-14 px-2 py-1 border border-[rgb(var(--color-border-primary))] rounded text-center bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
              placeholder="W"
            />
            <span className="text-[rgb(var(--color-text-muted))]">-</span>
            <input
              type="number"
              min="0"
              max="3"
              value={loserGames ?? ""}
              onChange={(e) =>
                setLoserGames(e.target.value ? parseInt(e.target.value) : undefined)
              }
              onBlur={handleUpdateScores}
              className="w-14 px-2 py-1 border border-[rgb(var(--color-border-primary))] rounded text-center bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
              placeholder="L"
            />
          </div>
        )}

        {/* Delete button */}
        {hasResult && (
          <button
            onClick={() => onDelete(position)}
            disabled={isSaving}
            className="p-2 text-[rgb(var(--color-error-icon))] hover:text-[rgb(var(--color-error-text))] hover:bg-[rgb(var(--color-error-bg-light))] rounded transition-colors"
            title="Clear result"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <span className="text-sm text-[rgb(var(--color-text-muted))]">Saving...</span>
        )}
      </div>
    </div>
  );
}
