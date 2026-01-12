/**
 * Result Mapper for Match Play to Internal Format
 *
 * Transforms Match Play game data into our internal Result format,
 * handling winner/loser determination and game score extraction.
 */

import type { MatchPlayGame, MatchPlayGamePlayer } from './types';
import type { ResultInput } from '@/lib/types';
import { mapMatchPlayGame } from './roundMapper';
import { ROUNDS } from '@/lib/bracket/constants';

/**
 * Mapped result ready for database insertion
 */
export interface MappedResult extends ResultInput {
  matchPlayGameId: number;
}

/**
 * Result of mapping Match Play games, including successes and failures
 */
export interface MapResultsOutput {
  results: MappedResult[];
  skipped: Array<{
    gameId: number;
    reason: string;
  }>;
  semiLoserSeeds: number[];
}

/**
 * Extract winner and loser from a completed Match Play game.
 *
 * @returns Winner and loser player data, or null if cannot determine
 */
function extractWinnerLoser(
  players: MatchPlayGamePlayer[] | undefined
): { winner: MatchPlayGamePlayer; loser: MatchPlayGamePlayer } | null {
  if (!players || players.length !== 2) return null;

  const winner = players.find((p) => p.result === 'win');
  const loser = players.find((p) => p.result === 'loss');

  if (!winner || !loser) return null;

  return { winner, loser };
}

/**
 * Map a single Match Play game to our internal result format.
 *
 * @param game The Match Play game to map
 * @param playerCount Tournament player count (16 or 24)
 * @param semiLoserSeeds Seeds of semi-final losers (for consolation detection)
 * @returns Mapped result or null if the game cannot be mapped
 */
export function mapSingleGame(
  game: MatchPlayGame,
  playerCount: 16 | 24,
  semiLoserSeeds: number[] = []
): MappedResult | { error: string } {
  // Only process completed games
  if (game.status !== 'completed') {
    return { error: 'Game not completed' };
  }

  // Extract winner and loser
  const outcome = extractWinnerLoser(game.players);
  if (!outcome) {
    return { error: 'Cannot determine winner/loser' };
  }

  const { winner, loser } = outcome;

  // Map to internal position
  const matchPosition = mapMatchPlayGame(
    game.round,
    game.gameNumber,
    winner.seed,
    loser.seed,
    playerCount,
    semiLoserSeeds
  );

  if (!matchPosition) {
    return { error: `Cannot map round ${game.round}, game ${game.gameNumber}` };
  }

  return {
    round: matchPosition.round,
    match_position: matchPosition.position,
    winner_seed: winner.seed,
    loser_seed: loser.seed,
    winner_games: winner.points || undefined,
    loser_games: loser.points || undefined,
    matchPlayGameId: game.gameId,
  };
}

/**
 * Find semi-final losers from a list of games.
 *
 * Needed to correctly identify the consolation (3rd place) match.
 */
function findSemiLoserSeeds(
  games: MatchPlayGame[],
  playerCount: 16 | 24
): number[] {
  const semiRoundMp = playerCount === 24 ? 3 : 2; // MP round number for semis
  const loserSeeds: number[] = [];

  for (const game of games) {
    if (game.round === semiRoundMp && game.status === 'completed') {
      const loser = game.players.find((p) => p.result === 'loss');
      if (loser) {
        loserSeeds.push(loser.seed);
      }
    }
  }

  return loserSeeds;
}

/**
 * Map multiple Match Play games to internal results.
 *
 * Processes all completed games and returns successfully mapped results
 * along with information about skipped games.
 *
 * @param games Array of Match Play games
 * @param playerCount Tournament player count (16 or 24)
 * @returns Mapped results and skipped game information
 */
export function mapMatchPlayGames(
  games: MatchPlayGame[],
  playerCount: 16 | 24
): MapResultsOutput {
  // First, find semi-final losers for consolation detection
  const semiLoserSeeds = findSemiLoserSeeds(games, playerCount);

  const results: MappedResult[] = [];
  const skipped: Array<{ gameId: number; reason: string }> = [];
  const seenPositions = new Set<string>();

  // Sort games by round and game number to process in order
  const sortedGames = [...games].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.gameNumber - b.gameNumber;
  });

  for (const game of sortedGames) {
    const result = mapSingleGame(game, playerCount, semiLoserSeeds);

    if ('error' in result) {
      skipped.push({ gameId: game.gameId, reason: result.error });
      continue;
    }

    // Check for duplicate positions (shouldn't happen, but be safe)
    const posKey = `${result.round}-${result.match_position}`;
    if (seenPositions.has(posKey)) {
      skipped.push({
        gameId: game.gameId,
        reason: `Duplicate position ${posKey}`,
      });
      continue;
    }

    seenPositions.add(posKey);
    results.push(result);
  }

  return { results, skipped, semiLoserSeeds };
}

/**
 * Count results by round for reporting.
 */
export function countResultsByRound(
  results: MappedResult[]
): Record<number, number> {
  const counts: Record<number, number> = {
    [ROUNDS.OPENING]: 0,
    [ROUNDS.ROUND_OF_16]: 0,
    [ROUNDS.QUARTERS]: 0,
    [ROUNDS.SEMIS]: 0,
    [ROUNDS.FINALS]: 0,
    [ROUNDS.CONSOLATION]: 0,
  };

  for (const result of results) {
    counts[result.round] = (counts[result.round] || 0) + 1;
  }

  return counts;
}
