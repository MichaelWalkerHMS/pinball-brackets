import { describe, it, expect } from 'vitest';
import {
  createMockResult,
  createOpeningRoundResults,
  createRoundOf16Results,
  createQuartersResults,
  createSemisResults,
  createFinalsResult,
  createConsolationResult,
  createCompleteTournamentResults,
  createPartialResults,
} from '../../fixtures/results';
import {
  ROUNDS,
  OPENING_ROUND_MATCHES,
  getPickKey,
} from '@/lib/bracket/constants';

const TEST_TOURNAMENT_ID = 'test-tournament-1';

describe('Results Fixtures', () => {
  describe('createMockResult', () => {
    it('creates a result with required fields', () => {
      const result = createMockResult({
        tournament_id: TEST_TOURNAMENT_ID,
        round: ROUNDS.OPENING,
        match_position: 0,
        winner_seed: 9,
        loser_seed: 24,
      });

      expect(result.tournament_id).toBe(TEST_TOURNAMENT_ID);
      expect(result.round).toBe(ROUNDS.OPENING);
      expect(result.match_position).toBe(0);
      expect(result.winner_seed).toBe(9);
      expect(result.loser_seed).toBe(24);
      expect(result.id).toBeDefined();
    });

    it('allows overriding game scores', () => {
      const result = createMockResult({
        tournament_id: TEST_TOURNAMENT_ID,
        round: ROUNDS.FINALS,
        match_position: 0,
        winner_seed: 1,
        loser_seed: 2,
        winner_games: 4,
        loser_games: 3,
      });

      expect(result.winner_games).toBe(4);
      expect(result.loser_games).toBe(3);
    });
  });

  describe('createOpeningRoundResults', () => {
    it('creates 8 results for opening round', () => {
      const results = createOpeningRoundResults(TEST_TOURNAMENT_ID);
      expect(results).toHaveLength(8);
    });

    it('creates results with correct pairings', () => {
      const results = createOpeningRoundResults(TEST_TOURNAMENT_ID);

      // Match the expected opening round pairings
      OPENING_ROUND_MATCHES.forEach((match) => {
        const result = results.find((r) => r.match_position === match.position);
        expect(result).toBeDefined();
        // Higher seed (lower number) should win
        expect(result?.winner_seed).toBe(match.topSeed);
        expect(result?.loser_seed).toBe(match.bottomSeed);
      });
    });

    it('all results are for the correct round', () => {
      const results = createOpeningRoundResults(TEST_TOURNAMENT_ID);
      results.forEach((r) => {
        expect(r.round).toBe(ROUNDS.OPENING);
      });
    });
  });

  describe('createRoundOf16Results', () => {
    it('creates 8 results for round of 16', () => {
      const results = createRoundOf16Results(TEST_TOURNAMENT_ID);
      expect(results).toHaveLength(8);
    });

    it('bye seeds defeat opening round winners', () => {
      const results = createRoundOf16Results(TEST_TOURNAMENT_ID);

      // Verify that bye seeds (1-8) are the winners
      results.forEach((result) => {
        expect(result.winner_seed).toBeGreaterThanOrEqual(1);
        expect(result.winner_seed).toBeLessThanOrEqual(8);
      });
    });
  });

  describe('createQuartersResults', () => {
    it('creates 4 results for quarterfinals', () => {
      const results = createQuartersResults(TEST_TOURNAMENT_ID);
      expect(results).toHaveLength(4);
    });
  });

  describe('createSemisResults', () => {
    it('creates 2 results for semifinals', () => {
      const results = createSemisResults(TEST_TOURNAMENT_ID);
      expect(results).toHaveLength(2);
    });

    it('semifinal winners are seeds 1 and 2', () => {
      const results = createSemisResults(TEST_TOURNAMENT_ID);
      const winners = results.map((r) => r.winner_seed).sort((a, b) => a - b);
      expect(winners).toEqual([1, 2]);
    });

    it('semifinal losers are seeds 3 and 4', () => {
      const results = createSemisResults(TEST_TOURNAMENT_ID);
      const losers = results.map((r) => r.loser_seed).sort((a, b) => a - b);
      expect(losers).toEqual([3, 4]);
    });
  });

  describe('createFinalsResult', () => {
    it('creates a single finals result', () => {
      const result = createFinalsResult(TEST_TOURNAMENT_ID);
      expect(result.round).toBe(ROUNDS.FINALS);
      expect(result.match_position).toBe(0);
    });

    it('has game scores', () => {
      const result = createFinalsResult(TEST_TOURNAMENT_ID);
      expect(result.winner_games).toBeDefined();
      expect(result.loser_games).toBeDefined();
    });
  });

  describe('createConsolationResult', () => {
    it('creates a single consolation result', () => {
      const result = createConsolationResult(TEST_TOURNAMENT_ID);
      expect(result.round).toBe(ROUNDS.CONSOLATION);
      expect(result.match_position).toBe(0);
    });

    it('consolation is between semifinal losers', () => {
      const result = createConsolationResult(TEST_TOURNAMENT_ID);
      // Semifinal losers are 3 and 4
      expect([3, 4]).toContain(result.winner_seed);
      expect([3, 4]).toContain(result.loser_seed);
    });
  });

  describe('createCompleteTournamentResults', () => {
    it('creates results for all rounds', () => {
      const results = createCompleteTournamentResults(TEST_TOURNAMENT_ID);

      // Count by round
      const countByRound = new Map<number, number>();
      results.forEach((r) => {
        countByRound.set(r.round, (countByRound.get(r.round) || 0) + 1);
      });

      expect(countByRound.get(ROUNDS.OPENING)).toBe(8);
      expect(countByRound.get(ROUNDS.ROUND_OF_16)).toBe(8);
      expect(countByRound.get(ROUNDS.QUARTERS)).toBe(4);
      expect(countByRound.get(ROUNDS.SEMIS)).toBe(2);
      expect(countByRound.get(ROUNDS.FINALS)).toBe(1);
      expect(countByRound.get(ROUNDS.CONSOLATION)).toBe(1);
    });

    it('total results count is correct', () => {
      const results = createCompleteTournamentResults(TEST_TOURNAMENT_ID);
      // 8 + 8 + 4 + 2 + 1 + 1 = 24
      expect(results).toHaveLength(24);
    });
  });

  describe('createPartialResults', () => {
    it('creates only opening round results when throughRound is OPENING', () => {
      const results = createPartialResults(TEST_TOURNAMENT_ID, ROUNDS.OPENING);
      expect(results).toHaveLength(8);
      results.forEach((r) => {
        expect(r.round).toBe(ROUNDS.OPENING);
      });
    });

    it('creates opening and R16 results when throughRound is ROUND_OF_16', () => {
      const results = createPartialResults(TEST_TOURNAMENT_ID, ROUNDS.ROUND_OF_16);
      expect(results).toHaveLength(16); // 8 + 8
    });

    it('creates results through quarters', () => {
      const results = createPartialResults(TEST_TOURNAMENT_ID, ROUNDS.QUARTERS);
      expect(results).toHaveLength(20); // 8 + 8 + 4
    });

    it('creates results through semis', () => {
      const results = createPartialResults(TEST_TOURNAMENT_ID, ROUNDS.SEMIS);
      expect(results).toHaveLength(22); // 8 + 8 + 4 + 2
    });
  });
});

describe('Results to Participant Mapping', () => {
  /**
   * Helper to get winner from a result map
   */
  function getResultWinner(
    resultMap: Map<string, { winner_seed: number; loser_seed: number }>,
    round: number,
    position: number
  ): number | null {
    const result = resultMap.get(getPickKey(round, position));
    return result?.winner_seed ?? null;
  }

  /**
   * Helper to get loser from a result map
   */
  function getResultLoser(
    resultMap: Map<string, { winner_seed: number; loser_seed: number }>,
    round: number,
    position: number
  ): number | null {
    const result = resultMap.get(getPickKey(round, position));
    return result?.loser_seed ?? null;
  }

  it('opening round winners feed into R16 correctly', () => {
    const openingResults = createOpeningRoundResults(TEST_TOURNAMENT_ID);
    const resultMap = new Map(
      openingResults.map((r) => [
        getPickKey(r.round, r.match_position),
        { winner_seed: r.winner_seed, loser_seed: r.loser_seed },
      ])
    );

    // R16 position 0: 1 vs winner of opening position 7 (16v17 -> 16 wins)
    const openingPos7Winner = getResultWinner(resultMap, ROUNDS.OPENING, 7);
    expect(openingPos7Winner).toBe(16);

    // R16 position 1: 8 vs winner of opening position 0 (9v24 -> 9 wins)
    const openingPos0Winner = getResultWinner(resultMap, ROUNDS.OPENING, 0);
    expect(openingPos0Winner).toBe(9);
  });

  it('semifinal losers become consolation participants', () => {
    const semisResults = createSemisResults(TEST_TOURNAMENT_ID);
    const resultMap = new Map(
      semisResults.map((r) => [
        getPickKey(r.round, r.match_position),
        { winner_seed: r.winner_seed, loser_seed: r.loser_seed },
      ])
    );

    // Consolation participants are the losers of semis
    const semiLoser0 = getResultLoser(resultMap, ROUNDS.SEMIS, 0);
    const semiLoser1 = getResultLoser(resultMap, ROUNDS.SEMIS, 1);

    expect(semiLoser0).toBe(4); // Loser of semi 0
    expect(semiLoser1).toBe(3); // Loser of semi 1
  });
});

describe('Results Cascade Logic', () => {
  it('changing an opening round result should invalidate R16 and beyond', () => {
    // This tests the concept - actual implementation is in the server action
    const results = createCompleteTournamentResults(TEST_TOURNAMENT_ID);

    // If we change opening round position 0 (9v24), it affects:
    // - R16 position 1 (8 vs winner of 9/24)
    // - Potentially quarters and beyond

    const affectedRounds = results.filter((r) => r.round > ROUNDS.OPENING);
    expect(affectedRounds.length).toBeGreaterThan(0);
  });

  it('changing a semifinal result only affects finals and consolation', () => {
    const results = createCompleteTournamentResults(TEST_TOURNAMENT_ID);

    // If we change a semifinal result, only finals and consolation are affected
    const roundsAfterSemis = results.filter((r) => r.round > ROUNDS.SEMIS);
    expect(roundsAfterSemis).toHaveLength(2); // Finals + Consolation
  });
});
