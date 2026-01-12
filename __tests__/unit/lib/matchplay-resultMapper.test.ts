import { describe, it, expect } from 'vitest';
import {
  buildSeedMap,
  getRoundFromIndex,
  getPositionFromIndex,
  mapMatchPlayGames,
  countResultsByRound,
} from '@/lib/matchplay/resultMapper';
import type { MatchPlayGame, MatchPlayPlayer } from '@/lib/matchplay/types';
import { ROUNDS } from '@/lib/bracket/constants';

// Helper to create mock games matching actual API structure
function createMockGame(overrides: Partial<MatchPlayGame> = {}): MatchPlayGame {
  return {
    gameId: 1001,
    tournamentId: 12345,
    roundId: 100001,
    index: 17, // Default to Opening round position
    set: 0,
    status: 'completed',
    bye: false,
    playerIds: [1009, 1024],
    userIds: [null, null],
    resultPositions: [1009, 1024], // Winner first
    resultPoints: ['1.00', '0.00'],
    resultScores: [null, null],
    arenaId: null,
    bankId: null,
    challengeId: null,
    playerIdAdvantage: null,
    scorekeeperId: null,
    startedAt: '2026-01-17T14:00:00Z',
    duration: 600,
    resultCountMismatch: false,
    suggestions: [],
    ...overrides,
  };
}

// Helper to create mock players matching actual API structure
function createMockPlayers(): MatchPlayPlayer[] {
  // Create players for seeds 1-24 (0-indexed in tournamentPlayer.seed)
  return Array.from({ length: 24 }, (_, i) => ({
    playerId: 1000 + i + 1, // playerId 1001-1024
    name: `Player ${i + 1}`,
    status: 'active' as const,
    ifpaId: null,
    claimedBy: null,
    tournamentPlayer: {
      status: 'active' as const,
      seed: i, // 0-indexed
      pointsAdjustment: 0,
    },
  }));
}

describe('resultMapper', () => {
  describe('buildSeedMap', () => {
    it('builds a map from playerId to 1-indexed seed', () => {
      const players = createMockPlayers();
      const seedMap = buildSeedMap(players);

      // Player 1001 has seed 0 in MP, which becomes seed 1
      expect(seedMap.get(1001)).toBe(1);
      // Player 1024 has seed 23 in MP, which becomes seed 24
      expect(seedMap.get(1024)).toBe(24);
    });

    it('handles players without tournamentPlayer data', () => {
      const players: MatchPlayPlayer[] = [
        {
          playerId: 1001,
          name: 'Player 1',
          status: 'active',
          ifpaId: null,
          claimedBy: null,
          // No tournamentPlayer
        },
      ];
      const seedMap = buildSeedMap(players);
      expect(seedMap.size).toBe(0);
    });
  });

  describe('getRoundFromIndex', () => {
    it('returns FINALS for index 1', () => {
      expect(getRoundFromIndex(1, 24)).toBe(ROUNDS.FINALS);
      expect(getRoundFromIndex(1, 16)).toBe(ROUNDS.FINALS);
    });

    it('returns SEMIS for indices 2-3', () => {
      expect(getRoundFromIndex(2, 24)).toBe(ROUNDS.SEMIS);
      expect(getRoundFromIndex(3, 24)).toBe(ROUNDS.SEMIS);
    });

    it('returns QUARTERS for indices 4-7', () => {
      expect(getRoundFromIndex(4, 24)).toBe(ROUNDS.QUARTERS);
      expect(getRoundFromIndex(7, 24)).toBe(ROUNDS.QUARTERS);
    });

    it('returns ROUND_OF_16 for indices 8-15', () => {
      expect(getRoundFromIndex(8, 24)).toBe(ROUNDS.ROUND_OF_16);
      expect(getRoundFromIndex(15, 24)).toBe(ROUNDS.ROUND_OF_16);
    });

    it('returns OPENING for indices 16-31 in 24-player', () => {
      expect(getRoundFromIndex(16, 24)).toBe(ROUNDS.OPENING);
      expect(getRoundFromIndex(31, 24)).toBe(ROUNDS.OPENING);
    });

    it('returns null for indices 16-31 in 16-player (no opening round)', () => {
      expect(getRoundFromIndex(16, 16)).toBeNull();
      expect(getRoundFromIndex(31, 16)).toBeNull();
    });

    it('returns null for index 0 (consolation)', () => {
      expect(getRoundFromIndex(0, 24)).toBeNull();
    });
  });

  describe('getPositionFromIndex', () => {
    it('returns correct positions for each round', () => {
      expect(getPositionFromIndex(1, ROUNDS.FINALS)).toBe(0);
      expect(getPositionFromIndex(2, ROUNDS.SEMIS)).toBe(0);
      expect(getPositionFromIndex(3, ROUNDS.SEMIS)).toBe(1);
      expect(getPositionFromIndex(4, ROUNDS.QUARTERS)).toBe(0);
      expect(getPositionFromIndex(7, ROUNDS.QUARTERS)).toBe(3);
      expect(getPositionFromIndex(8, ROUNDS.ROUND_OF_16)).toBe(0);
      expect(getPositionFromIndex(15, ROUNDS.ROUND_OF_16)).toBe(7);
      expect(getPositionFromIndex(16, ROUNDS.OPENING)).toBe(0);
      expect(getPositionFromIndex(23, ROUNDS.OPENING)).toBe(7);
    });
  });

  describe('mapMatchPlayGames', () => {
    it('maps opening round games correctly', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 17, // Opening round position
          playerIds: [1009, 1024], // Seed 9 vs Seed 24
          resultPositions: [1009, 1024], // Seed 9 wins
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(0);
      expect(results[0].round).toBe(ROUNDS.OPENING);
      expect(results[0].winner_seed).toBe(9);
      expect(results[0].loser_seed).toBe(24);
    });

    it('skips bye games', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          bye: true,
          playerIds: [1001],
          resultPositions: [1001],
          resultPoints: ['1.00'],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(0);
      expect(skipped).toHaveLength(0); // Byes are expected, not logged as skipped
    });

    it('skips multi-player consolation games', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 9999,
          playerIds: [1005, 1006, 1007, 1008], // 4-player game
          resultPositions: [1005, 1006, 1007, 1008],
          resultPoints: ['1.00', '0.67', '0.33', '0.00'],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(0);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toContain('Non-head-to-head');
    });

    it('identifies consolation match from semi-final losers', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        // Semi 1: Player 1 beats Player 4
        createMockGame({
          gameId: 2001,
          index: 2,
          playerIds: [1001, 1004],
          resultPositions: [1001, 1004],
        }),
        // Semi 2: Player 2 beats Player 3
        createMockGame({
          gameId: 2002,
          index: 3,
          playerIds: [1002, 1003],
          resultPositions: [1002, 1003],
        }),
        // Consolation: Player 3 vs Player 4 (index 0)
        createMockGame({
          gameId: 2003,
          index: 0,
          playerIds: [1003, 1004],
          resultPositions: [1003, 1004],
        }),
      ];

      const { results } = mapMatchPlayGames(games, players, 24);

      const consolation = results.find((r) => r.round === ROUNDS.CONSOLATION);
      expect(consolation).toBeDefined();
      expect(consolation?.winner_seed).toBe(3);
      expect(consolation?.loser_seed).toBe(4);
    });

    it('validates finals match has semi-final winners', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        // Semi 1: Player 1 beats Player 4
        createMockGame({
          gameId: 2001,
          index: 2,
          playerIds: [1001, 1004],
          resultPositions: [1001, 1004],
        }),
        // Semi 2: Player 2 beats Player 3
        createMockGame({
          gameId: 2002,
          index: 3,
          playerIds: [1002, 1003],
          resultPositions: [1002, 1003],
        }),
        // Finals: Player 1 vs Player 2
        createMockGame({
          gameId: 2003,
          index: 1,
          playerIds: [1001, 1002],
          resultPositions: [1001, 1002],
        }),
      ];

      const { results } = mapMatchPlayGames(games, players, 24);

      const finals = results.find((r) => r.round === ROUNDS.FINALS);
      expect(finals).toBeDefined();
      expect(finals?.winner_seed).toBe(1);
      expect(finals?.loser_seed).toBe(2);
    });

    it('handles duplicate positions by skipping duplicates', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 17,
          playerIds: [1009, 1024],
          resultPositions: [1009, 1024],
        }),
        // Duplicate with same index
        createMockGame({
          gameId: 1002,
          index: 17,
          playerIds: [1009, 1024],
          resultPositions: [1009, 1024],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toContain('Duplicate position');
    });
  });

  describe('countResultsByRound', () => {
    it('counts results by round', () => {
      const results = [
        { round: 0, match_position: 0, winner_seed: 9, loser_seed: 24, matchPlayGameId: 1 },
        { round: 0, match_position: 1, winner_seed: 10, loser_seed: 23, matchPlayGameId: 2 },
        { round: 1, match_position: 0, winner_seed: 1, loser_seed: 9, matchPlayGameId: 3 },
        { round: 2, match_position: 0, winner_seed: 1, loser_seed: 4, matchPlayGameId: 4 },
      ];

      const counts = countResultsByRound(results);

      expect(counts[ROUNDS.OPENING]).toBe(2);
      expect(counts[ROUNDS.ROUND_OF_16]).toBe(1);
      expect(counts[ROUNDS.QUARTERS]).toBe(1);
      expect(counts[ROUNDS.SEMIS]).toBe(0);
      expect(counts[ROUNDS.FINALS]).toBe(0);
    });
  });
});
