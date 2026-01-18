import { describe, it, expect } from 'vitest';
import {
  buildSeedMap,
  getRoundFromIndex,
  getPositionFromIndex,
  getOpeningRoundPosition,
  getOpeningRoundPositionFromIndex,
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
    it('returns correct positions for each round (except Opening)', () => {
      expect(getPositionFromIndex(1, ROUNDS.FINALS)).toBe(0);
      expect(getPositionFromIndex(2, ROUNDS.SEMIS)).toBe(0);
      expect(getPositionFromIndex(3, ROUNDS.SEMIS)).toBe(1);
      expect(getPositionFromIndex(4, ROUNDS.QUARTERS)).toBe(0);
      expect(getPositionFromIndex(7, ROUNDS.QUARTERS)).toBe(3);
      expect(getPositionFromIndex(8, ROUNDS.ROUND_OF_16)).toBe(0);
      expect(getPositionFromIndex(15, ROUNDS.ROUND_OF_16)).toBe(7);
      // Note: Opening Round uses getOpeningRoundPosition() instead
    });
  });

  describe('getOpeningRoundPosition', () => {
    it('returns correct position for each opening round matchup', () => {
      // Position 0: 9 vs 24
      expect(getOpeningRoundPosition(9, 24)).toBe(0);
      expect(getOpeningRoundPosition(24, 9)).toBe(0); // Order doesn't matter
      // Position 1: 10 vs 23
      expect(getOpeningRoundPosition(10, 23)).toBe(1);
      // Position 2: 11 vs 22
      expect(getOpeningRoundPosition(11, 22)).toBe(2);
      // Position 3: 12 vs 21
      expect(getOpeningRoundPosition(12, 21)).toBe(3);
      // Position 4: 13 vs 20
      expect(getOpeningRoundPosition(13, 20)).toBe(4);
      // Position 5: 14 vs 19
      expect(getOpeningRoundPosition(14, 19)).toBe(5);
      // Position 6: 15 vs 18
      expect(getOpeningRoundPosition(15, 18)).toBe(6);
      // Position 7: 16 vs 17
      expect(getOpeningRoundPosition(16, 17)).toBe(7);
    });

    it('returns -1 for invalid seed combinations', () => {
      expect(getOpeningRoundPosition(1, 2)).toBe(-1); // Bye seeds
      expect(getOpeningRoundPosition(9, 23)).toBe(-1); // Wrong pairing
      expect(getOpeningRoundPosition(10, 24)).toBe(-1); // Wrong pairing
    });
  });

  describe('getOpeningRoundPositionFromIndex', () => {
    it('returns correct position for all valid opening round indices', () => {
      // Match Play index to position mapping for 32-bracket opening round
      expect(getOpeningRoundPositionFromIndex(17)).toBe(7);
      expect(getOpeningRoundPositionFromIndex(18)).toBe(0);
      expect(getOpeningRoundPositionFromIndex(21)).toBe(4);
      expect(getOpeningRoundPositionFromIndex(22)).toBe(3);
      expect(getOpeningRoundPositionFromIndex(25)).toBe(6);
      expect(getOpeningRoundPositionFromIndex(26)).toBe(1);
      expect(getOpeningRoundPositionFromIndex(29)).toBe(5);
      expect(getOpeningRoundPositionFromIndex(30)).toBe(2);
    });

    it('returns -1 for invalid indices', () => {
      expect(getOpeningRoundPositionFromIndex(0)).toBe(-1);
      expect(getOpeningRoundPositionFromIndex(1)).toBe(-1);
      expect(getOpeningRoundPositionFromIndex(16)).toBe(-1); // Not a valid opening round index
      expect(getOpeningRoundPositionFromIndex(19)).toBe(-1);
      expect(getOpeningRoundPositionFromIndex(31)).toBe(-1);
      expect(getOpeningRoundPositionFromIndex(100)).toBe(-1);
    });
  });

  describe('mapMatchPlayGames', () => {
    it('maps opening round games correctly', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 17, // Match Play uses various indices for opening round
          playerIds: [1009, 1024], // Seed 9 vs Seed 24
          resultPositions: [1009, 1024], // Seed 9 wins
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(0);
      expect(results[0].round).toBe(ROUNDS.OPENING);
      expect(results[0].match_position).toBe(0); // 9v24 is position 0
      expect(results[0].winner_seed).toBe(9);
      expect(results[0].loser_seed).toBe(24);
    });

    it('maps opening round games with non-contiguous indices correctly', () => {
      const players = createMockPlayers();
      // Test with indices that would fail with simple index-based calculation
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 25, // Would be position 9 with index-16, but should map to position 5 (14v19)
          playerIds: [1014, 1019], // Seed 14 vs Seed 19
          resultPositions: [1014, 1019], // Seed 14 wins
        }),
        createMockGame({
          gameId: 1002,
          index: 30, // Would be position 14 with index-16, but should map to position 6 (15v18)
          playerIds: [1015, 1018], // Seed 15 vs Seed 18
          resultPositions: [1018, 1015], // Seed 18 wins (upset)
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(2);
      expect(skipped).toHaveLength(0);

      const result1 = results.find(r => r.matchPlayGameId === 1001);
      expect(result1?.round).toBe(ROUNDS.OPENING);
      expect(result1?.match_position).toBe(5); // 14v19 is position 5
      expect(result1?.winner_seed).toBe(14);
      expect(result1?.loser_seed).toBe(19);

      const result2 = results.find(r => r.matchPlayGameId === 1002);
      expect(result2?.round).toBe(ROUNDS.OPENING);
      expect(result2?.match_position).toBe(6); // 15v18 is position 6
      expect(result2?.winner_seed).toBe(18); // Upset winner
      expect(result2?.loser_seed).toBe(15);
    });

    it('falls back to index-based position when seeds are shifted (player removed)', () => {
      // Simulate a bracket where seed 23 was removed, shifting pairings
      // Seed 10 now plays seed 24 instead of seed 23
      const players: MatchPlayPlayer[] = [
        ...Array.from({ length: 22 }, (_, i) => ({
          playerId: 1000 + i + 1, // 1001-1022 for seeds 1-22
          name: `Player ${i + 1}`,
          status: 'active' as const,
          ifpaId: null,
          claimedBy: null,
          tournamentPlayer: { status: 'active' as const, seed: i, pointsAdjustment: 0 },
        })),
        // Skip seed 23, go straight to seed 24 and 25
        {
          playerId: 1024,
          name: 'Player 24',
          status: 'active' as const,
          ifpaId: null,
          claimedBy: null,
          tournamentPlayer: { status: 'active' as const, seed: 23, pointsAdjustment: 0 }, // 0-indexed
        },
        {
          playerId: 1025,
          name: 'Player 25',
          status: 'active' as const,
          ifpaId: null,
          claimedBy: null,
          tournamentPlayer: { status: 'active' as const, seed: 24, pointsAdjustment: 0 }, // 0-indexed
        },
      ];

      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 26, // Position 1 in opening round (where 10v23 would normally be)
          playerIds: [1010, 1024], // Seed 10 vs Seed 24 (shifted pairing)
          resultPositions: [1010, 1024], // Seed 10 wins
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 24);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(0);
      expect(results[0].round).toBe(ROUNDS.OPENING);
      expect(results[0].match_position).toBe(1); // Falls back to index-based: 26 -> 1
      expect(results[0].winner_seed).toBe(10);
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

  describe('per-game tracking support', () => {
    it('maps games using resultPoints when resultPositions are null', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8, // Round of 16, position 0
          playerIds: [1001, 1016], // Seed 1 vs Seed 16
          resultPositions: [null as unknown as number, null as unknown as number], // Null positions (per-game tracking)
          resultPoints: ['4.00', '0.00'], // Seed 1 won 4 games, Seed 16 won 0
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(1);
      expect(skipped).toHaveLength(0);
      expect(results[0].round).toBe(ROUNDS.ROUND_OF_16);
      expect(results[0].match_position).toBe(0);
      expect(results[0].winner_seed).toBe(1);
      expect(results[0].loser_seed).toBe(16);
      expect(results[0].winner_games).toBe(4);
      expect(results[0].loser_games).toBe(0);
    });

    it('correctly identifies winner when player2 has more points', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8,
          playerIds: [1001, 1016], // Seed 1 vs Seed 16
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: ['2.00', '4.00'], // Seed 16 won (upset!)
        }),
      ];

      const { results } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(1);
      expect(results[0].winner_seed).toBe(16); // Upset
      expect(results[0].loser_seed).toBe(1);
      expect(results[0].winner_games).toBe(4);
      expect(results[0].loser_games).toBe(2);
    });

    it('extracts game counts from resultPoints when resultPositions are valid', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8,
          playerIds: [1001, 1016],
          resultPositions: [1001, 1016], // Standard format with valid positions
          resultPoints: ['4.00', '3.00'], // Best of 7 where seed 1 won 4-3
        }),
      ];

      const { results } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(1);
      expect(results[0].winner_seed).toBe(1);
      expect(results[0].loser_seed).toBe(16);
      expect(results[0].winner_games).toBe(4);
      expect(results[0].loser_games).toBe(3);
    });

    it('skips games with tied points (incomplete match)', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8,
          playerIds: [1001, 1016],
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: ['2.00', '2.00'], // Tied, no winner yet
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(0);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toContain('tied');
    });

    it('skips incomplete games even with partial per-game results', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8,
          status: 'started', // Not completed
          playerIds: [1001, 1016],
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: ['3.00', '1.00'], // Partial results
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(0);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toBe('Game not completed');
    });

    it('handles 16-player tournament Round of 16 correctly', () => {
      const players = createMockPlayers().slice(0, 16); // Only 16 players
      const games: MatchPlayGame[] = [
        // All 8 Round of 16 matches
        createMockGame({
          gameId: 1001,
          index: 8,
          playerIds: [1001, 1016],
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: ['4.00', '0.00'],
        }),
        createMockGame({
          gameId: 1002,
          index: 9,
          playerIds: [1008, 1009],
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: ['4.00', '2.00'],
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(2);
      expect(skipped).toHaveLength(0);

      // Verify correct positions
      expect(results[0].round).toBe(ROUNDS.ROUND_OF_16);
      expect(results[0].match_position).toBe(0); // index 8 -> position 0
      expect(results[1].match_position).toBe(1); // index 9 -> position 1
    });

    it('handles missing resultPoints gracefully', () => {
      const players = createMockPlayers();
      const games: MatchPlayGame[] = [
        createMockGame({
          gameId: 1001,
          index: 8,
          playerIds: [1001, 1016],
          resultPositions: [null as unknown as number, null as unknown as number],
          resultPoints: [], // Empty - invalid
        }),
      ];

      const { results, skipped } = mapMatchPlayGames(games, players, 16);

      expect(results).toHaveLength(0);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toContain('Missing result data');
    });
  });
});
