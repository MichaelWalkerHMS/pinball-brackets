// Valid tournament player counts
export const VALID_PLAYER_COUNTS = [16, 24] as const;
export type ValidPlayerCount = (typeof VALID_PLAYER_COUNTS)[number];

export function isValidPlayerCount(count: number): count is ValidPlayerCount {
  return VALID_PLAYER_COUNTS.includes(count as ValidPlayerCount);
}

// Round identifiers
export const ROUNDS = {
  OPENING: 0,
  ROUND_OF_16: 1,
  QUARTERS: 2,
  SEMIS: 3,
  FINALS: 4,
  CONSOLATION: 5,
} as const;

export const ROUND_NAMES: Record<number, string> = {
  [ROUNDS.OPENING]: 'Opening Round',
  [ROUNDS.ROUND_OF_16]: 'Round of 16',
  [ROUNDS.QUARTERS]: 'Quarterfinals',
  [ROUNDS.SEMIS]: 'Semifinals',
  [ROUNDS.FINALS]: 'Finals',
  [ROUNDS.CONSOLATION]: '3rd Place',
};

// Number of matches in each round
export const MATCHES_PER_ROUND: Record<number, number> = {
  [ROUNDS.OPENING]: 8,
  [ROUNDS.ROUND_OF_16]: 8,
  [ROUNDS.QUARTERS]: 4,
  [ROUNDS.SEMIS]: 2,
  [ROUNDS.FINALS]: 1,
  [ROUNDS.CONSOLATION]: 1,
};

// Opening round pairings (seeds 9-24 play, seeds 1-8 have byes)
export const OPENING_ROUND_MATCHES: Array<{
  position: number;
  topSeed: number;
  bottomSeed: number;
}> = [
  { position: 0, topSeed: 9, bottomSeed: 24 },
  { position: 1, topSeed: 10, bottomSeed: 23 },
  { position: 2, topSeed: 11, bottomSeed: 22 },
  { position: 3, topSeed: 12, bottomSeed: 21 },
  { position: 4, topSeed: 13, bottomSeed: 20 },
  { position: 5, topSeed: 14, bottomSeed: 19 },
  { position: 6, topSeed: 15, bottomSeed: 18 },
  { position: 7, topSeed: 16, bottomSeed: 17 },
];

// Round of 16: bye seeds paired with opening round winners
// Maps R16 position to the bye seed and which opening round winner they face
export const ROUND_OF_16_MATCHES: Array<{
  position: number;
  byeSeed: number;
  openingWinnerPosition: number;
}> = [
  { position: 0, byeSeed: 1, openingWinnerPosition: 7 }, // 1 vs winner of 16/17
  { position: 1, byeSeed: 8, openingWinnerPosition: 0 }, // 8 vs winner of 9/24
  { position: 2, byeSeed: 4, openingWinnerPosition: 4 }, // 4 vs winner of 13/20
  { position: 3, byeSeed: 5, openingWinnerPosition: 3 }, // 5 vs winner of 12/21
  { position: 4, byeSeed: 2, openingWinnerPosition: 6 }, // 2 vs winner of 15/18
  { position: 5, byeSeed: 7, openingWinnerPosition: 1 }, // 7 vs winner of 10/23
  { position: 6, byeSeed: 3, openingWinnerPosition: 5 }, // 3 vs winner of 14/19
  { position: 7, byeSeed: 6, openingWinnerPosition: 2 }, // 6 vs winner of 11/22
];

// 16-player Round of 16: Direct seed pairings (no opening round)
// Ordered to maintain compatibility with QUARTERS_MATCHES flow
export const ROUND_OF_16_MATCHES_16P: Array<{
  position: number;
  topSeed: number;
  bottomSeed: number;
}> = [
  { position: 0, topSeed: 1, bottomSeed: 16 },
  { position: 1, topSeed: 8, bottomSeed: 9 },
  { position: 2, topSeed: 4, bottomSeed: 13 },
  { position: 3, topSeed: 5, bottomSeed: 12 },
  { position: 4, topSeed: 2, bottomSeed: 15 },
  { position: 5, topSeed: 7, bottomSeed: 10 },
  { position: 6, topSeed: 3, bottomSeed: 14 },
  { position: 7, topSeed: 6, bottomSeed: 11 },
];

// Quarterfinals: winners from pairs of R16 matches
export const QUARTERS_MATCHES: Array<{
  position: number;
  topSourcePosition: number;
  bottomSourcePosition: number;
}> = [
  { position: 0, topSourcePosition: 0, bottomSourcePosition: 1 },
  { position: 1, topSourcePosition: 2, bottomSourcePosition: 3 },
  { position: 2, topSourcePosition: 4, bottomSourcePosition: 5 },
  { position: 3, topSourcePosition: 6, bottomSourcePosition: 7 },
];

// Semifinals: winners from pairs of QF matches
export const SEMIS_MATCHES: Array<{
  position: number;
  topSourcePosition: number;
  bottomSourcePosition: number;
}> = [
  { position: 0, topSourcePosition: 0, bottomSourcePosition: 1 },
  { position: 1, topSourcePosition: 2, bottomSourcePosition: 3 },
];

// Finals: winners of both semifinals
export const FINALS_MATCH = {
  position: 0,
  topSourcePosition: 0,
  bottomSourcePosition: 1,
};

// Consolation (3rd place): losers of both semifinals
export const CONSOLATION_MATCH = {
  position: 0,
  topSourcePosition: 0, // Loser of semi 0
  bottomSourcePosition: 1, // Loser of semi 1
};

// Seeds that get a bye in the opening round
export const BYE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// Total predictions needed for a complete bracket
export const TOTAL_PREDICTIONS = 24;

// Display order for opening round matches to align with bracket flow
// Maps display position (0-7) to actual match position
// This ensures each opening match is visually adjacent to the R16 match it feeds
export const OPENING_DISPLAY_ORDER = [7, 0, 4, 3, 6, 1, 5, 2];

// Helper to generate a pick key from round and position
export function getPickKey(round: number, position: number): string {
  return `${round}-${position}`;
}

// Parse a pick key back to round and position
export function parsePickKey(key: string): { round: number; position: number } {
  const [round, position] = key.split('-').map(Number);
  return { round, position };
}
