/**
 * Round Mapper for Match Play to Internal Format
 *
 * Maps Match Play tournament rounds and match positions to our internal
 * bracket format. Handles both 24-player and 16-player tournaments.
 */

import {
  ROUNDS,
  OPENING_ROUND_MATCHES,
  ROUND_OF_16_MATCHES,
  ROUND_OF_16_MATCHES_16P,
  QUARTERS_MATCHES,
  SEMIS_MATCHES,
} from '@/lib/bracket/constants';

export interface MatchPosition {
  round: number;
  position: number;
}

/**
 * Map a Match Play round number to our internal round number.
 *
 * 24-player: MP rounds map directly (0=Opening, 1=R16, 2=QF, 3=SF, 4=Finals)
 * 16-player: MP rounds are offset by 1 (0=R16, 1=QF, 2=SF, 3=Finals)
 */
export function mapMatchPlayRound(
  mpRound: number,
  playerCount: 16 | 24
): number {
  if (playerCount === 16) {
    // 16-player tournaments skip opening round
    return mpRound + 1;
  }
  // 24-player: direct mapping
  return mpRound;
}

/**
 * Find the internal match position for a game based on the seeds playing.
 *
 * This looks up the match in our bracket structure by finding where these
 * two seeds would meet, rather than using Match Play's game number directly.
 *
 * @returns The internal position (0-indexed) or null if not found
 */
export function findMatchPositionBySeeds(
  round: number,
  seed1: number,
  seed2: number,
  playerCount: 16 | 24
): number | null {
  // Sort seeds so we can compare consistently
  const [lowerSeed, higherSeed] = [seed1, seed2].sort((a, b) => a - b);

  switch (round) {
    case ROUNDS.OPENING: {
      // Only 24-player tournaments have opening round
      if (playerCount === 16) return null;

      const match = OPENING_ROUND_MATCHES.find(
        (m) =>
          (m.topSeed === lowerSeed && m.bottomSeed === higherSeed) ||
          (m.topSeed === higherSeed && m.bottomSeed === lowerSeed)
      );
      return match?.position ?? null;
    }

    case ROUNDS.ROUND_OF_16: {
      if (playerCount === 16) {
        // 16-player: direct seed pairings
        const match = ROUND_OF_16_MATCHES_16P.find(
          (m) =>
            (m.topSeed === lowerSeed && m.bottomSeed === higherSeed) ||
            (m.topSeed === higherSeed && m.bottomSeed === lowerSeed)
        );
        return match?.position ?? null;
      } else {
        // 24-player: bye seeds vs opening round winners
        // One seed should be a bye seed (1-8), the other is an opening round winner (9-24)
        const byeSeed = lowerSeed <= 8 ? lowerSeed : higherSeed;
        const match = ROUND_OF_16_MATCHES.find((m) => m.byeSeed === byeSeed);
        return match?.position ?? null;
      }
    }

    case ROUNDS.QUARTERS: {
      // For quarters and beyond, we need to find by examining the bracket flow
      // We can't directly map seeds to positions for these rounds
      // Instead, we match by game number from Match Play (passed as fallback)
      return null;
    }

    case ROUNDS.SEMIS:
    case ROUNDS.FINALS:
    case ROUNDS.CONSOLATION:
      // Later rounds can't be mapped by seeds alone
      return null;

    default:
      return null;
  }
}

/**
 * Get the expected match count for a round.
 */
export function getMatchCountForRound(round: number, playerCount: 16 | 24): number {
  switch (round) {
    case ROUNDS.OPENING:
      return playerCount === 24 ? 8 : 0;
    case ROUNDS.ROUND_OF_16:
      return 8;
    case ROUNDS.QUARTERS:
      return 4;
    case ROUNDS.SEMIS:
      return 2;
    case ROUNDS.FINALS:
      return 1;
    case ROUNDS.CONSOLATION:
      return 1;
    default:
      return 0;
  }
}

/**
 * Find match position by game number within a round.
 *
 * Match Play's gameNumber is 1-indexed position within the round.
 * Our positions are 0-indexed.
 *
 * @param mpGameNumber Match Play's game number (1-indexed)
 * @returns Internal position (0-indexed)
 */
export function mapGameNumberToPosition(mpGameNumber: number): number {
  return mpGameNumber - 1;
}

/**
 * Determine if a match is the consolation (3rd place) match.
 *
 * The consolation match involves the two semi-final losers.
 * In Match Play, this is typically marked as a separate match after the semis.
 */
export function isConsolationMatch(
  seeds: number[],
  semiLoserSeeds: number[]
): boolean {
  if (semiLoserSeeds.length !== 2) return false;

  // Check if both players in this match are semi-final losers
  const sortedSeeds = [...seeds].sort((a, b) => a - b);
  const sortedLoserSeeds = [...semiLoserSeeds].sort((a, b) => a - b);

  return (
    sortedSeeds.length === 2 &&
    sortedSeeds[0] === sortedLoserSeeds[0] &&
    sortedSeeds[1] === sortedLoserSeeds[1]
  );
}

/**
 * Map a complete Match Play game to our internal match position.
 *
 * This is the main entry point for mapping games. It handles:
 * - Round mapping (24 vs 16 player)
 * - Position mapping (by seeds for early rounds, by game number for later)
 * - Consolation match detection
 *
 * @param mpRound Match Play round number
 * @param mpGameNumber Match Play game number within round (1-indexed)
 * @param seed1 First player's seed
 * @param seed2 Second player's seed
 * @param playerCount Tournament player count
 * @param semiLoserSeeds Seeds of semi-final losers (for consolation detection)
 * @returns Internal match position or null if cannot be mapped
 */
export function mapMatchPlayGame(
  mpRound: number,
  mpGameNumber: number,
  seed1: number,
  seed2: number,
  playerCount: 16 | 24,
  semiLoserSeeds: number[] = []
): MatchPosition | null {
  const internalRound = mapMatchPlayRound(mpRound, playerCount);

  // Check for consolation match
  if (isConsolationMatch([seed1, seed2], semiLoserSeeds)) {
    return { round: ROUNDS.CONSOLATION, position: 0 };
  }

  // For opening and R16, try to find by seeds
  const seedPosition = findMatchPositionBySeeds(
    internalRound,
    seed1,
    seed2,
    playerCount
  );

  if (seedPosition !== null) {
    return { round: internalRound, position: seedPosition };
  }

  // For later rounds, use game number mapping
  if (
    internalRound === ROUNDS.QUARTERS ||
    internalRound === ROUNDS.SEMIS ||
    internalRound === ROUNDS.FINALS
  ) {
    const maxMatches = getMatchCountForRound(internalRound, playerCount);
    const position = mapGameNumberToPosition(mpGameNumber);

    if (position >= 0 && position < maxMatches) {
      return { round: internalRound, position };
    }
  }

  return null;
}
