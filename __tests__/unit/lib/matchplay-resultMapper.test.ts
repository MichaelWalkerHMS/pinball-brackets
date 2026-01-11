import { describe, it, expect } from 'vitest';
import {
  mapSingleGame,
  mapMatchPlayGames,
  countResultsByRound,
} from '@/lib/matchplay/resultMapper';
import type { MatchPlayGame } from '@/lib/matchplay/types';
import { ROUNDS } from '@/lib/bracket/constants';

// Helper to create mock games
function createMockGame(overrides: Partial<MatchPlayGame> = {}): MatchPlayGame {
  return {
    gameId: 1001,
    tournamentId: 12345,
    round: 0,
    gameNumber: 1,
    status: 'completed',
    arenaId: 1,
    arenaName: 'Arena 1',
    completedAt: '2026-01-17T14:00:00Z',
    createdAt: '2026-01-17T12:00:00Z',
    updatedAt: '2026-01-17T14:00:00Z',
    players: [
      { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
      { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
    ],
    ...overrides,
  };
}

describe('resultMapper', () => {
  describe('mapSingleGame', () => {
    it('maps a completed Opening round game correctly', () => {
      const game = createMockGame({
        round: 0,
        gameNumber: 1,
        players: [
          { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
          { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
        ],
      });

      const result = mapSingleGame(game, 24);

      expect(result).not.toHaveProperty('error');
      if (!('error' in result)) {
        expect(result.round).toBe(ROUNDS.OPENING);
        expect(result.match_position).toBe(0);
        expect(result.winner_seed).toBe(9);
        expect(result.loser_seed).toBe(24);
        expect(result.winner_games).toBe(3);
        expect(result.loser_games).toBe(1);
        expect(result.matchPlayGameId).toBe(1001);
      }
    });

    it('returns error for non-completed games', () => {
      const game = createMockGame({ status: 'started' });
      const result = mapSingleGame(game, 24);

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Game not completed');
    });

    it('returns error when winner/loser cannot be determined', () => {
      const game = createMockGame({
        players: [
          { playerId: 1009, seed: 9, points: 0, result: null, position: 1 },
          { playerId: 1024, seed: 24, points: 0, result: null, position: 2 },
        ],
      });

      const result = mapSingleGame(game, 24);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Cannot determine winner/loser');
    });

    it('handles 16-player tournament mapping', () => {
      const game = createMockGame({
        round: 0, // MP round 0 = R16 for 16-player
        gameNumber: 1,
        players: [
          { playerId: 1001, seed: 1, points: 3, result: 'win', position: 1 },
          { playerId: 1016, seed: 16, points: 1, result: 'loss', position: 2 },
        ],
      });

      const result = mapSingleGame(game, 16);

      expect(result).not.toHaveProperty('error');
      if (!('error' in result)) {
        expect(result.round).toBe(ROUNDS.ROUND_OF_16);
        expect(result.match_position).toBe(0);
        expect(result.winner_seed).toBe(1);
        expect(result.loser_seed).toBe(16);
      }
    });

    it('handles consolation match with semi loser seeds', () => {
      const game = createMockGame({
        round: 4, // Finals round in MP
        gameNumber: 2,
        players: [
          { playerId: 1003, seed: 3, points: 3, result: 'win', position: 1 },
          { playerId: 1005, seed: 5, points: 2, result: 'loss', position: 2 },
        ],
      });

      const semiLoserSeeds = [3, 5];
      const result = mapSingleGame(game, 24, semiLoserSeeds);

      expect(result).not.toHaveProperty('error');
      if (!('error' in result)) {
        expect(result.round).toBe(ROUNDS.CONSOLATION);
        expect(result.match_position).toBe(0);
      }
    });
  });

  describe('mapMatchPlayGames', () => {
    it('maps multiple games and returns results', () => {
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          round: 0,
          gameNumber: 1,
          players: [
            { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
            { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
          ],
        }),
        createMockGame({
          gameId: 1002,
          round: 0,
          gameNumber: 2,
          players: [
            { playerId: 1010, seed: 10, points: 3, result: 'win', position: 1 },
            { playerId: 1023, seed: 23, points: 0, result: 'loss', position: 2 },
          ],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, 24);

      expect(results).toHaveLength(2);
      expect(skipped).toHaveLength(0);
      expect(results[0].winner_seed).toBe(9);
      expect(results[1].winner_seed).toBe(10);
    });

    it('skips non-completed games', () => {
      const games: MatchPlayGame[] = [
        createMockGame({ gameId: 1001, status: 'completed' }),
        createMockGame({ gameId: 1002, status: 'started' }),
        createMockGame({ gameId: 1003, status: 'pending' }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(2);
      expect(skipped[0].reason).toBe('Game not completed');
    });

    it('returns semi loser seeds for consolation detection', () => {
      const games: MatchPlayGame[] = [
        // Semi-final games
        createMockGame({
          gameId: 2001,
          round: 3, // Semis
          gameNumber: 1,
          players: [
            { playerId: 1001, seed: 1, points: 3, result: 'win', position: 1 },
            { playerId: 1004, seed: 4, points: 2, result: 'loss', position: 2 },
          ],
        }),
        createMockGame({
          gameId: 2002,
          round: 3, // Semis
          gameNumber: 2,
          players: [
            { playerId: 1002, seed: 2, points: 3, result: 'win', position: 1 },
            { playerId: 1003, seed: 3, points: 1, result: 'loss', position: 2 },
          ],
        }),
      ];

      const { semiLoserSeeds } = mapMatchPlayGames(games, 24);

      expect(semiLoserSeeds).toContain(4);
      expect(semiLoserSeeds).toContain(3);
    });

    it('handles duplicate positions by skipping duplicates', () => {
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          round: 0,
          gameNumber: 1,
          players: [
            { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
            { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
          ],
        }),
        // Duplicate with same position
        createMockGame({
          gameId: 1002,
          round: 0,
          gameNumber: 1,
          players: [
            { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
            { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
          ],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toContain('Duplicate position');
    });

    it('sorts games by round and game number before processing', () => {
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1002,
          round: 0,
          gameNumber: 2,
          players: [
            { playerId: 1010, seed: 10, points: 3, result: 'win', position: 1 },
            { playerId: 1023, seed: 23, points: 0, result: 'loss', position: 2 },
          ],
        }),
        createMockGame({
          gameId: 1001,
          round: 0,
          gameNumber: 1,
          players: [
            { playerId: 1009, seed: 9, points: 3, result: 'win', position: 1 },
            { playerId: 1024, seed: 24, points: 1, result: 'loss', position: 2 },
          ],
        }),
      ];

      const { results } = mapMatchPlayGames(games, 24);

      // First result should be the one with lower game number
      expect(results[0].matchPlayGameId).toBe(1001);
      expect(results[1].matchPlayGameId).toBe(1002);
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
