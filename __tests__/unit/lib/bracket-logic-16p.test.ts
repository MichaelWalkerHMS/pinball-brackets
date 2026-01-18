import { describe, it, expect } from 'vitest'
import {
  getMatchLoser,
  getMatchParticipants,
  applyPick,
} from '@/lib/bracket/logic'
import { ROUNDS, getPickKey, ROUND_OF_16_MATCHES_16P } from '@/lib/bracket/constants'

/**
 * Tests for 16-player tournament bracket logic.
 * Key differences from 24-player:
 * - No opening round
 * - R16 has direct seed pairings (1v16, 8v9, etc.)
 */
describe('16-player bracket logic', () => {
  describe('getMatchParticipants - Opening Round', () => {
    it('returns null participants for 16-player tournaments', () => {
      const picks = new Map<string, number>()
      const result = getMatchParticipants(picks, ROUNDS.OPENING, 0, 16)
      expect(result).toEqual({ topSeed: null, bottomSeed: null })
    })

    it('returns null for all opening round positions', () => {
      const picks = new Map<string, number>()
      for (let pos = 0; pos < 8; pos++) {
        const result = getMatchParticipants(picks, ROUNDS.OPENING, pos, 16)
        expect(result).toEqual({ topSeed: null, bottomSeed: null })
      }
    })
  })

  describe('getMatchParticipants - Round of 16', () => {
    it('returns direct seed pairings for position 0 (1 vs 16)', () => {
      const picks = new Map<string, number>()
      const result = getMatchParticipants(picks, ROUNDS.ROUND_OF_16, 0, 16)
      expect(result).toEqual({ topSeed: 1, bottomSeed: 16 })
    })

    it('returns direct seed pairings for position 1 (8 vs 9)', () => {
      const picks = new Map<string, number>()
      const result = getMatchParticipants(picks, ROUNDS.ROUND_OF_16, 1, 16)
      expect(result).toEqual({ topSeed: 8, bottomSeed: 9 })
    })

    it('returns correct seed pairings for all R16 positions', () => {
      const picks = new Map<string, number>()

      for (let pos = 0; pos < 8; pos++) {
        const expected = ROUND_OF_16_MATCHES_16P[pos]
        const result = getMatchParticipants(picks, ROUNDS.ROUND_OF_16, pos, 16)
        expect(result).toEqual({
          topSeed: expected.topSeed,
          bottomSeed: expected.bottomSeed
        })
      }
    })

    it('does not depend on opening round picks', () => {
      const picks = new Map<string, number>()
      // Even if we set opening picks, 16-player R16 should use direct pairings
      picks.set(getPickKey(ROUNDS.OPENING, 0), 9)
      picks.set(getPickKey(ROUNDS.OPENING, 7), 16)

      const result = getMatchParticipants(picks, ROUNDS.ROUND_OF_16, 0, 16)
      // Should still be 1 vs 16, not affected by opening picks
      expect(result).toEqual({ topSeed: 1, bottomSeed: 16 })
    })
  })

  describe('getMatchParticipants - Later rounds', () => {
    it('returns R16 winners for quarterfinals', () => {
      const picks = new Map<string, number>()
      // Pick R16 winners (position 0 and 1 feed into QF position 0)
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 0), 1)  // 1 beats 16
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 1), 8)  // 8 beats 9

      const result = getMatchParticipants(picks, ROUNDS.QUARTERS, 0, 16)
      expect(result).toEqual({ topSeed: 1, bottomSeed: 8 })
    })

    it('returns QF winners for semifinals', () => {
      const picks = new Map<string, number>()
      picks.set(getPickKey(ROUNDS.QUARTERS, 0), 1)
      picks.set(getPickKey(ROUNDS.QUARTERS, 1), 4)

      const result = getMatchParticipants(picks, ROUNDS.SEMIS, 0, 16)
      expect(result).toEqual({ topSeed: 1, bottomSeed: 4 })
    })

    it('returns SF winners for finals', () => {
      const picks = new Map<string, number>()
      picks.set(getPickKey(ROUNDS.SEMIS, 0), 1)
      picks.set(getPickKey(ROUNDS.SEMIS, 1), 2)

      const result = getMatchParticipants(picks, ROUNDS.FINALS, 0, 16)
      expect(result).toEqual({ topSeed: 1, bottomSeed: 2 })
    })

    it('returns SF losers for consolation', () => {
      const picks = new Map<string, number>()
      // Set up QF winners to determine SF participants
      picks.set(getPickKey(ROUNDS.QUARTERS, 0), 1)
      picks.set(getPickKey(ROUNDS.QUARTERS, 1), 4)
      picks.set(getPickKey(ROUNDS.QUARTERS, 2), 2)
      picks.set(getPickKey(ROUNDS.QUARTERS, 3), 3)

      // Set SF winners (losers go to consolation)
      picks.set(getPickKey(ROUNDS.SEMIS, 0), 1) // 1 beats 4
      picks.set(getPickKey(ROUNDS.SEMIS, 1), 2) // 2 beats 3

      const result = getMatchParticipants(picks, ROUNDS.CONSOLATION, 0, 16)
      expect(result).toEqual({ topSeed: 4, bottomSeed: 3 })
    })
  })

  describe('getMatchLoser - 16-player', () => {
    it('returns null for opening round (no opening in 16-player)', () => {
      const picks = new Map<string, number>()
      expect(getMatchLoser(picks, ROUNDS.OPENING, 0, 16)).toBeNull()
    })

    it('returns loser for R16 match', () => {
      const picks = new Map<string, number>()
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 0), 1) // 1 beats 16
      expect(getMatchLoser(picks, ROUNDS.ROUND_OF_16, 0, 16)).toBe(16)
    })

    it('returns loser when underdog wins', () => {
      const picks = new Map<string, number>()
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 0), 16) // Upset! 16 beats 1
      expect(getMatchLoser(picks, ROUNDS.ROUND_OF_16, 0, 16)).toBe(1)
    })
  })

  describe('Full 16-player bracket simulation', () => {
    it('correctly propagates a complete chalk bracket', () => {
      const picks = new Map<string, number>()

      // R16: All favorites win (lower seeds)
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 0), 1)  // 1 beats 16
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 1), 8)  // 8 beats 9
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 2), 4)  // 4 beats 13
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 3), 5)  // 5 beats 12
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 4), 2)  // 2 beats 15
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 5), 7)  // 7 beats 10
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 6), 3)  // 3 beats 14
      picks.set(getPickKey(ROUNDS.ROUND_OF_16, 7), 6)  // 6 beats 11

      // Verify QF participants
      expect(getMatchParticipants(picks, ROUNDS.QUARTERS, 0, 16)).toEqual({ topSeed: 1, bottomSeed: 8 })
      expect(getMatchParticipants(picks, ROUNDS.QUARTERS, 1, 16)).toEqual({ topSeed: 4, bottomSeed: 5 })
      expect(getMatchParticipants(picks, ROUNDS.QUARTERS, 2, 16)).toEqual({ topSeed: 2, bottomSeed: 7 })
      expect(getMatchParticipants(picks, ROUNDS.QUARTERS, 3, 16)).toEqual({ topSeed: 3, bottomSeed: 6 })

      // QF: All favorites win
      picks.set(getPickKey(ROUNDS.QUARTERS, 0), 1)
      picks.set(getPickKey(ROUNDS.QUARTERS, 1), 4)
      picks.set(getPickKey(ROUNDS.QUARTERS, 2), 2)
      picks.set(getPickKey(ROUNDS.QUARTERS, 3), 3)

      // Verify SF participants
      expect(getMatchParticipants(picks, ROUNDS.SEMIS, 0, 16)).toEqual({ topSeed: 1, bottomSeed: 4 })
      expect(getMatchParticipants(picks, ROUNDS.SEMIS, 1, 16)).toEqual({ topSeed: 2, bottomSeed: 3 })

      // SF: Seeds 1 and 2 win
      picks.set(getPickKey(ROUNDS.SEMIS, 0), 1)
      picks.set(getPickKey(ROUNDS.SEMIS, 1), 2)

      // Verify Finals and Consolation participants
      expect(getMatchParticipants(picks, ROUNDS.FINALS, 0, 16)).toEqual({ topSeed: 1, bottomSeed: 2 })
      expect(getMatchParticipants(picks, ROUNDS.CONSOLATION, 0, 16)).toEqual({ topSeed: 4, bottomSeed: 3 })

      // Total picks should be 14 (8 R16 + 4 QF + 2 SF)
      expect(picks.size).toBe(14)
    })

    it('correctly handles cascade when changing R16 pick', () => {
      let picks = new Map<string, number>()

      // Build bracket where seed 1 advances
      picks = applyPick(picks, ROUNDS.ROUND_OF_16, 0, 1) // 1 beats 16
      picks = applyPick(picks, ROUNDS.QUARTERS, 0, 1)     // 1 beats 8
      picks = applyPick(picks, ROUNDS.SEMIS, 0, 1)        // 1 advances

      expect(picks.size).toBe(3)

      // Change R16 pick to upset (16 beats 1)
      picks = applyPick(picks, ROUNDS.ROUND_OF_16, 0, 16)

      // Should only have the R16 pick now (downstream cleared)
      expect(picks.size).toBe(1)
      expect(picks.get(getPickKey(ROUNDS.ROUND_OF_16, 0))).toBe(16)
    })

    it('counts correct number of picks for complete bracket', () => {
      // 16-player bracket: 8 R16 + 4 QF + 2 SF + 1 Final + 1 Consolation = 16 picks
      const picks = new Map<string, number>()

      // R16
      for (let i = 0; i < 8; i++) {
        picks.set(getPickKey(ROUNDS.ROUND_OF_16, i), ROUND_OF_16_MATCHES_16P[i].topSeed)
      }
      // QF
      picks.set(getPickKey(ROUNDS.QUARTERS, 0), 1)
      picks.set(getPickKey(ROUNDS.QUARTERS, 1), 4)
      picks.set(getPickKey(ROUNDS.QUARTERS, 2), 2)
      picks.set(getPickKey(ROUNDS.QUARTERS, 3), 3)
      // SF
      picks.set(getPickKey(ROUNDS.SEMIS, 0), 1)
      picks.set(getPickKey(ROUNDS.SEMIS, 1), 2)
      // Finals
      picks.set(getPickKey(ROUNDS.FINALS, 0), 1)
      // Consolation
      picks.set(getPickKey(ROUNDS.CONSOLATION, 0), 4)

      expect(picks.size).toBe(16)
    })
  })

  describe('Backwards compatibility - default to 24-player', () => {
    it('getMatchParticipants defaults to 24-player behavior', () => {
      const picks = new Map<string, number>()
      // Without playerCount param, should use 24-player logic (opening round has participants)
      const result = getMatchParticipants(picks, ROUNDS.OPENING, 0)
      expect(result).toEqual({ topSeed: 9, bottomSeed: 24 })
    })

    it('getMatchLoser defaults to 24-player behavior', () => {
      const picks = new Map<string, number>()
      picks.set(getPickKey(ROUNDS.OPENING, 0), 9)
      // Without playerCount param, should use 24-player logic
      const result = getMatchLoser(picks, ROUNDS.OPENING, 0)
      expect(result).toBe(24)
    })
  })
})
