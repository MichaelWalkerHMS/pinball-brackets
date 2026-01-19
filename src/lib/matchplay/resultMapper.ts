/**
 * Result Mapper for Match Play to Internal Format
 *
 * Transforms Match Play game data into our internal Result format.
 * Handles:
 * - Filtering bye games and multi-player consolation matches
 * - Round detection via standard bracket indexing
 * - Winner/loser determination from resultPositions or resultPoints
 * - Per-game score extraction from resultPoints (e.g., best-of-7 match tracking)
 * - Semi-final tracking for Finals vs Consolation validation
 */

import type { MatchPlayGame, MatchPlayPlayer } from './types';
import type { ResultInput } from '@/lib/types';
import { ROUNDS, OPENING_ROUND_MATCHES } from '@/lib/bracket/constants';

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
}

/**
 * Player ID to seed lookup map
 */
type SeedMap = Map<number, number>;

/**
 * Build a playerId → seed lookup map from tournament players.
 * Seeds are converted from 0-indexed (Match Play) to 1-indexed (our system).
 */
export function buildSeedMap(players: MatchPlayPlayer[]): SeedMap {
  const seedMap = new Map<number, number>();

  for (const player of players) {
    const mpSeed = player.tournamentPlayer?.seed;
    if (mpSeed != null) {
      // Convert 0-indexed to 1-indexed
      seedMap.set(player.playerId, mpSeed + 1);
    }
  }

  return seedMap;
}

/**
 * Determine internal round from Match Play game index.
 *
 * Standard single-elimination bracket indexing:
 * - index 1 = Finals
 * - index 2-3 = Semifinals
 * - index 4-7 = Quarterfinals
 * - index 8-15 = Round of 16
 * - index 16-31 = Round of 32 (Opening round for 24-player)
 *
 * Returns null for indices that don't fit standard bracket (consolation games).
 */
export function getRoundFromIndex(index: number, playerCount: 16 | 24): number | null {
  if (index === 1) return ROUNDS.FINALS;
  if (index >= 2 && index <= 3) return ROUNDS.SEMIS;
  if (index >= 4 && index <= 7) return ROUNDS.QUARTERS;
  if (index >= 8 && index <= 15) return ROUNDS.ROUND_OF_16;
  if (index >= 16 && index <= 31 && playerCount === 24) return ROUNDS.OPENING;

  // Index 0 or other values indicate consolation - handled separately
  return null;
}

/**
 * Get match position within a round from the game index.
 *
 * For standard bracket indices:
 * - Finals (index 1): position 0
 * - Semis (index 2-3): position 0-1
 * - Quarters (index 4-7): position 0-3
 * - R16 (index 8-15): position 0-7
 * - Opening: use getOpeningRoundPosition() instead (index-based doesn't work)
 */
export function getPositionFromIndex(index: number, round: number): number {
  switch (round) {
    case ROUNDS.FINALS:
      return 0; // Only one finals match
    case ROUNDS.SEMIS:
      return index - 2; // index 2 → pos 0, index 3 → pos 1
    case ROUNDS.QUARTERS:
      return index - 4; // index 4-7 → pos 0-3
    case ROUNDS.ROUND_OF_16:
      return index - 8; // index 8-15 → pos 0-7
    case ROUNDS.CONSOLATION:
      return 0; // Only one consolation match
    default:
      return 0;
  }
}

/**
 * Get Opening Round position from the seeds playing in a match.
 *
 * Match Play uses non-contiguous indices (17, 18, 21, 22, 25, 26, 29, 30)
 * for opening round in a 32-bracket, so we determine position by which
 * seeds are playing rather than from the index.
 *
 * @returns Position 0-7 if found, -1 if seeds don't match any opening match
 */
export function getOpeningRoundPosition(seed1: number, seed2: number): number {
  // Find the opening round match that contains both seeds
  for (const match of OPENING_ROUND_MATCHES) {
    const seeds = [match.topSeed, match.bottomSeed];
    if (seeds.includes(seed1) && seeds.includes(seed2)) {
      return match.position;
    }
  }
  return -1; // Not found
}

/**
 * Fallback: Get Opening Round position from Match Play game index.
 *
 * Used when seed pairings don't match expected values (e.g., when a player
 * was removed from the bracket, shifting the pairings).
 *
 * Match Play index to position mapping for 32-bracket opening round:
 * 17→7, 18→0, 21→4, 22→3, 25→6, 26→1, 29→5, 30→2
 *
 * @returns Position 0-7 if valid opening round index, -1 otherwise
 */
export function getOpeningRoundPositionFromIndex(index: number): number {
  const indexToPosition: Record<number, number> = {
    17: 7,
    18: 0,
    21: 4,
    22: 3,
    25: 6,
    26: 1,
    29: 5,
    30: 2,
  };
  return indexToPosition[index] ?? -1;
}

/**
 * Result of extracting winner/loser from a game, including game counts.
 */
interface GameResult {
  winnerId: number;
  loserId: number;
  winnerGames: number | undefined;
  loserGames: number | undefined;
}

/**
 * Check if resultPositions contains valid (non-null) player IDs.
 */
function hasValidResultPositions(game: MatchPlayGame): boolean {
  return (
    game.resultPositions &&
    game.resultPositions.length >= 2 &&
    game.resultPositions[0] !== null &&
    game.resultPositions[1] !== null
  );
}

/**
 * Check if resultPoints contains valid data to determine a winner.
 * Used when per-game tracking is enabled and resultPositions are null.
 */
function hasValidResultPoints(game: MatchPlayGame): boolean {
  if (!game.resultPoints || game.resultPoints.length !== 2) return false;
  if (game.playerIds.length !== 2) return false;

  const points = game.resultPoints.map((p) => parseFloat(p) || 0);
  // Must have different point values to determine a winner
  return points[0] !== points[1];
}

/**
 * Check if a game is a valid head-to-head match we should process.
 */
function isValidGame(game: MatchPlayGame): boolean {
  // Skip bye games
  if (game.bye) return false;

  // Skip non-head-to-head matches (e.g., 4-player 5th-8th consolation)
  if (game.playerIds.length !== 2) return false;

  // Skip incomplete games
  if (game.status !== 'completed') return false;

  // Must have either valid resultPositions OR valid resultPoints
  if (!hasValidResultPositions(game) && !hasValidResultPoints(game)) return false;

  return true;
}

/**
 * Extract winner and loser player IDs from a game.
 *
 * Supports two MatchPlay result formats:
 * 1. Standard W/L: resultPositions = [winnerId, loserId]
 * 2. Per-game tracking: resultPositions = [null, null], resultPoints = ["4.00", "2.00"]
 *    - Player with higher points is the winner
 *    - Points represent games won in a best-of-N match
 */
function getWinnerLoser(game: MatchPlayGame): GameResult | null {
  // Method 1: Use resultPositions if valid (standard W/L format)
  if (hasValidResultPositions(game)) {
    // Parse game counts from resultPoints if available
    let winnerGames: number | undefined;
    let loserGames: number | undefined;

    if (game.resultPoints && game.resultPoints.length === 2) {
      // resultPoints is aligned with playerIds, not resultPositions
      // So we need to find which points belong to winner vs loser
      const winnerId = game.resultPositions[0];
      const winnerIndex = game.playerIds.indexOf(winnerId);

      if (winnerIndex !== -1) {
        const loserIndex = winnerIndex === 0 ? 1 : 0;
        winnerGames = Math.floor(parseFloat(game.resultPoints[winnerIndex]) || 0);
        loserGames = Math.floor(parseFloat(game.resultPoints[loserIndex]) || 0);
      }
    }

    return {
      winnerId: game.resultPositions[0],
      loserId: game.resultPositions[1],
      winnerGames,
      loserGames,
    };
  }

  // Method 2: Determine winner from resultPoints (per-game tracking format)
  if (hasValidResultPoints(game)) {
    const points = game.resultPoints.map((p) => parseFloat(p) || 0);
    const [player1Id, player2Id] = game.playerIds;

    // Higher points = winner
    const winnerIndex = points[0] > points[1] ? 0 : 1;
    const loserIndex = winnerIndex === 0 ? 1 : 0;

    return {
      winnerId: winnerIndex === 0 ? player1Id : player2Id,
      loserId: loserIndex === 0 ? player1Id : player2Id,
      winnerGames: Math.floor(points[winnerIndex]),
      loserGames: Math.floor(points[loserIndex]),
    };
  }

  return null;
}

/**
 * Find semi-final results to identify winners and losers.
 * Used to validate Finals and detect Consolation match.
 */
function findSemiResults(
  games: MatchPlayGame[],
  playerCount: 16 | 24
): { winners: Set<number>; losers: Set<number> } {
  const winners = new Set<number>();
  const losers = new Set<number>();

  for (const game of games) {
    if (!isValidGame(game)) continue;

    const round = getRoundFromIndex(game.index, playerCount);
    if (round !== ROUNDS.SEMIS) continue;

    const result = getWinnerLoser(game);
    if (result) {
      winners.add(result.winnerId);
      losers.add(result.loserId);
    }
  }

  return { winners, losers };
}

/**
 * Check if both players in a game are semi-final losers (consolation match).
 */
function isConsolationMatch(playerIds: number[], semiLosers: Set<number>): boolean {
  if (semiLosers.size !== 2) return false;
  return playerIds.every((id) => semiLosers.has(id));
}

/**
 * Check if both players in a game are semi-final winners (finals match).
 */
function isFinalsMatch(playerIds: number[], semiWinners: Set<number>): boolean {
  if (semiWinners.size !== 2) return false;
  return playerIds.every((id) => semiWinners.has(id));
}

/**
 * Map a single Match Play game to our internal result format.
 */
function mapSingleGame(
  game: MatchPlayGame,
  playerCount: 16 | 24,
  seedMap: SeedMap,
  semiWinners: Set<number>,
  semiLosers: Set<number>
): MappedResult | { error: string } {
  // Get winner and loser
  const result = getWinnerLoser(game);
  if (!result) {
    return { error: 'Cannot determine winner/loser' };
  }

  const { winnerId, loserId, winnerGames, loserGames } = result;

  // Look up seeds
  const winnerSeed = seedMap.get(winnerId);
  const loserSeed = seedMap.get(loserId);

  if (!winnerSeed || !loserSeed) {
    return { error: `Cannot find seed for player ${!winnerSeed ? winnerId : loserId}` };
  }

  // Determine round from index
  let round = getRoundFromIndex(game.index, playerCount);

  // Handle consolation match (index 0 or unrecognized index)
  if (round === null) {
    if (isConsolationMatch(game.playerIds, semiLosers)) {
      round = ROUNDS.CONSOLATION;
    } else {
      return { error: `Unknown game type: index=${game.index}` };
    }
  }

  // Validate finals match
  if (round === ROUNDS.FINALS && !isFinalsMatch(game.playerIds, semiWinners)) {
    // This might be consolation misidentified, check if it's actually consolation
    if (isConsolationMatch(game.playerIds, semiLosers)) {
      round = ROUNDS.CONSOLATION;
    } else {
      return { error: 'Finals match players do not match semi-final winners' };
    }
  }

  // Get position within round
  let position: number;
  if (round === ROUNDS.OPENING) {
    // For Opening Round, determine position from seeds first
    position = getOpeningRoundPosition(winnerSeed, loserSeed);
    if (position === -1) {
      // Fallback: use index-based mapping (handles cases where players were removed)
      position = getOpeningRoundPositionFromIndex(game.index);
      if (position === -1) {
        return { error: `Opening round seeds ${winnerSeed} vs ${loserSeed} don't match expected pairings and index ${game.index} is not a valid opening round index` };
      }
    }
  } else {
    position = getPositionFromIndex(game.index, round);
  }

  return {
    round,
    match_position: position,
    winner_seed: winnerSeed,
    loser_seed: loserSeed,
    winner_games: winnerGames,
    loser_games: loserGames,
    matchPlayGameId: game.gameId,
  };
}

/**
 * Map multiple Match Play games to internal results.
 *
 * @param games Array of Match Play games
 * @param players Array of Match Play players (for seed lookup)
 * @param playerCount Tournament player count (16 or 24)
 * @returns Mapped results and skipped game information
 */
export function mapMatchPlayGames(
  games: MatchPlayGame[],
  players: MatchPlayPlayer[],
  playerCount: 16 | 24
): MapResultsOutput {
  // Build seed lookup map
  const seedMap = buildSeedMap(players);

  // Find semi-final results for Finals/Consolation detection
  const { winners: semiWinners, losers: semiLosers } = findSemiResults(games, playerCount);

  const results: MappedResult[] = [];
  const skipped: Array<{ gameId: number; reason: string }> = [];
  const seenPositions = new Set<string>();

  for (const game of games) {
    // Filter invalid games
    if (!isValidGame(game)) {
      if (game.bye) {
        // Don't log bye games as skipped - they're expected
        continue;
      }

      // Determine specific skip reason
      let reason: string;
      if (game.playerIds.length !== 2) {
        reason = `Non-head-to-head match (${game.playerIds.length} players)`;
      } else if (game.status !== 'completed') {
        reason = 'Game not completed';
      } else if (!hasValidResultPositions(game) && !hasValidResultPoints(game)) {
        // Check if it's a tied game
        if (game.resultPoints && game.resultPoints.length === 2) {
          const points = game.resultPoints.map((p) => parseFloat(p) || 0);
          if (points[0] === points[1]) {
            reason = `Game tied at ${points[0]}-${points[1]} (no winner yet)`;
          } else {
            reason = 'Invalid result data';
          }
        } else {
          reason = 'Missing result data';
        }
      } else {
        reason = 'Invalid game data';
      }

      skipped.push({ gameId: game.gameId, reason });
      continue;
    }

    const result = mapSingleGame(game, playerCount, seedMap, semiWinners, semiLosers);

    if ('error' in result) {
      skipped.push({ gameId: game.gameId, reason: result.error });
      continue;
    }

    // Check for duplicate positions
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

  return { results, skipped };
}

/**
 * Count results by round for reporting.
 */
export function countResultsByRound(results: MappedResult[]): Record<number, number> {
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
