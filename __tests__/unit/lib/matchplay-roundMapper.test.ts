import { describe, it, expect } from 'vitest';
import {
  mapMatchPlayRound,
  findMatchPositionBySeeds,
  mapGameNumberToPosition,
  isConsolationMatch,
  mapMatchPlayGame,
  getMatchCountForRound,
} from '@/lib/matchplay/roundMapper';
import { ROUNDS } from '@/lib/bracket/constants';

describe('roundMapper', () => {
  describe('mapMatchPlayRound', () => {
    describe('24-player tournaments', () => {
      it('maps MP round 0 to Opening round (0)', () => {
        expect(mapMatchPlayRound(0, 24)).toBe(ROUNDS.OPENING);
      });

      it('maps MP round 1 to Round of 16 (1)', () => {
        expect(mapMatchPlayRound(1, 24)).toBe(ROUNDS.ROUND_OF_16);
      });

      it('maps MP round 2 to Quarterfinals (2)', () => {
        expect(mapMatchPlayRound(2, 24)).toBe(ROUNDS.QUARTERS);
      });

      it('maps MP round 3 to Semifinals (3)', () => {
        expect(mapMatchPlayRound(3, 24)).toBe(ROUNDS.SEMIS);
      });

      it('maps MP round 4 to Finals (4)', () => {
        expect(mapMatchPlayRound(4, 24)).toBe(ROUNDS.FINALS);
      });
    });

    describe('16-player tournaments', () => {
      it('maps MP round 0 to Round of 16 (1) - offset by 1', () => {
        expect(mapMatchPlayRound(0, 16)).toBe(ROUNDS.ROUND_OF_16);
      });

      it('maps MP round 1 to Quarterfinals (2)', () => {
        expect(mapMatchPlayRound(1, 16)).toBe(ROUNDS.QUARTERS);
      });

      it('maps MP round 2 to Semifinals (3)', () => {
        expect(mapMatchPlayRound(2, 16)).toBe(ROUNDS.SEMIS);
      });

      it('maps MP round 3 to Finals (4)', () => {
        expect(mapMatchPlayRound(3, 16)).toBe(ROUNDS.FINALS);
      });
    });
  });

  describe('findMatchPositionBySeeds', () => {
    describe('24-player Opening round', () => {
      it('finds position 0 for seeds 9 vs 24', () => {
        expect(findMatchPositionBySeeds(ROUNDS.OPENING, 9, 24, 24)).toBe(0);
      });

      it('finds position 7 for seeds 16 vs 17', () => {
        expect(findMatchPositionBySeeds(ROUNDS.OPENING, 16, 17, 24)).toBe(7);
      });

      it('finds position for reversed seed order', () => {
        expect(findMatchPositionBySeeds(ROUNDS.OPENING, 24, 9, 24)).toBe(0);
      });

      it('returns null for invalid seeds', () => {
        expect(findMatchPositionBySeeds(ROUNDS.OPENING, 1, 2, 24)).toBeNull();
      });

      it('returns null for 16-player tournaments', () => {
        expect(findMatchPositionBySeeds(ROUNDS.OPENING, 9, 24, 16)).toBeNull();
      });
    });

    describe('24-player Round of 16', () => {
      it('finds position 0 for seed 1 vs opening winner', () => {
        // Position 0 has bye seed 1
        expect(findMatchPositionBySeeds(ROUNDS.ROUND_OF_16, 1, 16, 24)).toBe(0);
      });

      it('finds position 1 for seed 8 vs opening winner', () => {
        expect(findMatchPositionBySeeds(ROUNDS.ROUND_OF_16, 8, 9, 24)).toBe(1);
      });
    });

    describe('16-player Round of 16', () => {
      it('finds position 0 for seeds 1 vs 16', () => {
        expect(findMatchPositionBySeeds(ROUNDS.ROUND_OF_16, 1, 16, 16)).toBe(0);
      });

      it('finds position 1 for seeds 8 vs 9', () => {
        expect(findMatchPositionBySeeds(ROUNDS.ROUND_OF_16, 8, 9, 16)).toBe(1);
      });

      it('finds position 2 for seeds 4 vs 13', () => {
        expect(findMatchPositionBySeeds(ROUNDS.ROUND_OF_16, 4, 13, 16)).toBe(2);
      });
    });

    describe('later rounds', () => {
      it('returns null for Quarterfinals (cannot map by seeds)', () => {
        expect(findMatchPositionBySeeds(ROUNDS.QUARTERS, 1, 8, 24)).toBeNull();
      });

      it('returns null for Semifinals', () => {
        expect(findMatchPositionBySeeds(ROUNDS.SEMIS, 1, 2, 24)).toBeNull();
      });
    });
  });

  describe('mapGameNumberToPosition', () => {
    it('converts 1-indexed game number to 0-indexed position', () => {
      expect(mapGameNumberToPosition(1)).toBe(0);
      expect(mapGameNumberToPosition(2)).toBe(1);
      expect(mapGameNumberToPosition(8)).toBe(7);
    });
  });

  describe('getMatchCountForRound', () => {
    it('returns correct counts for 24-player tournaments', () => {
      expect(getMatchCountForRound(ROUNDS.OPENING, 24)).toBe(8);
      expect(getMatchCountForRound(ROUNDS.ROUND_OF_16, 24)).toBe(8);
      expect(getMatchCountForRound(ROUNDS.QUARTERS, 24)).toBe(4);
      expect(getMatchCountForRound(ROUNDS.SEMIS, 24)).toBe(2);
      expect(getMatchCountForRound(ROUNDS.FINALS, 24)).toBe(1);
      expect(getMatchCountForRound(ROUNDS.CONSOLATION, 24)).toBe(1);
    });

    it('returns 0 matches for 16-player Opening round', () => {
      expect(getMatchCountForRound(ROUNDS.OPENING, 16)).toBe(0);
    });
  });

  describe('isConsolationMatch', () => {
    it('identifies consolation match with semi losers', () => {
      const semiLoserSeeds = [2, 4];
      expect(isConsolationMatch([2, 4], semiLoserSeeds)).toBe(true);
      expect(isConsolationMatch([4, 2], semiLoserSeeds)).toBe(true);
    });

    it('returns false when seeds do not match semi losers', () => {
      const semiLoserSeeds = [2, 4];
      expect(isConsolationMatch([1, 3], semiLoserSeeds)).toBe(false);
    });

    it('returns false when no semi losers provided', () => {
      expect(isConsolationMatch([2, 4], [])).toBe(false);
    });
  });

  describe('mapMatchPlayGame', () => {
    describe('24-player tournaments', () => {
      it('maps Opening round game correctly', () => {
        const result = mapMatchPlayGame(0, 1, 9, 24, 24);
        expect(result).toEqual({ round: ROUNDS.OPENING, position: 0 });
      });

      it('maps Round of 16 game correctly', () => {
        const result = mapMatchPlayGame(1, 1, 1, 16, 24);
        expect(result).toEqual({ round: ROUNDS.ROUND_OF_16, position: 0 });
      });

      it('maps Quarterfinals game by game number', () => {
        const result = mapMatchPlayGame(2, 1, 1, 8, 24);
        expect(result).toEqual({ round: ROUNDS.QUARTERS, position: 0 });
      });

      it('maps Semifinals game by game number', () => {
        const result = mapMatchPlayGame(3, 2, 1, 2, 24);
        expect(result).toEqual({ round: ROUNDS.SEMIS, position: 1 });
      });

      it('maps Finals game', () => {
        const result = mapMatchPlayGame(4, 1, 1, 2, 24);
        expect(result).toEqual({ round: ROUNDS.FINALS, position: 0 });
      });

      it('identifies consolation match', () => {
        const semiLoserSeeds = [3, 5];
        const result = mapMatchPlayGame(4, 2, 3, 5, 24, semiLoserSeeds);
        expect(result).toEqual({ round: ROUNDS.CONSOLATION, position: 0 });
      });
    });

    describe('16-player tournaments', () => {
      it('maps Round of 16 game correctly (MP round 0)', () => {
        const result = mapMatchPlayGame(0, 1, 1, 16, 16);
        expect(result).toEqual({ round: ROUNDS.ROUND_OF_16, position: 0 });
      });

      it('maps Quarterfinals game (MP round 1)', () => {
        const result = mapMatchPlayGame(1, 1, 1, 8, 16);
        expect(result).toEqual({ round: ROUNDS.QUARTERS, position: 0 });
      });
    });
  });
});
