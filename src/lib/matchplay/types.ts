/**
 * Match Play Events API Types
 *
 * These types represent the response structures from the Match Play Events API.
 * API Documentation: https://app.matchplay.events/api
 */

// ============================================================================
// Tournament Types
// ============================================================================

export interface MatchPlayTournament {
  tournamentId: number;
  name: string;
  status: 'created' | 'started' | 'completed';
  startDate: string | null;
  endDate: string | null;
  type: string; // e.g., 'bracket', 'group_knockout', etc.
  organizerId: number;
  venueId: number | null;
  venueName: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Number of games per match. For bracket tournaments:
   * - 1 = Single match (standard W/L, uses resultPositions)
   * - 3, 5, 7, etc. = Best-of-N (per-game tracking, uses resultPoints)
   */
  bestOf?: number;
  /** Size of the bracket (16, 32, etc.) */
  bracketSize?: number;
}

export interface MatchPlayTournamentWithPlayers extends MatchPlayTournament {
  players: MatchPlayPlayer[];
}

// ============================================================================
// Player Types
// ============================================================================

export interface MatchPlayPlayer {
  playerId: number;
  name: string;
  status: 'active' | 'withdrawn' | 'eliminated';
  ifpaId: number | null;
  claimedBy: number | null; // User ID who claimed this player profile
  // Tournament-specific player info (when fetched with includePlayers=true)
  tournamentPlayer?: {
    status: 'active' | 'withdrawn' | 'eliminated';
    seed: number | null;
    pointsAdjustment: number;
  };
}

// ============================================================================
// Game/Match Types
// ============================================================================

/**
 * Match Play game as returned by the API.
 *
 * Key fields for result mapping:
 * - playerIds: Array of player IDs in the game
 * - resultPositions: Array of player IDs in finishing order [winner, loser]
 * - resultPoints: Points awarded to each player (aligned with playerIds)
 * - bye: True if this is a bye game (auto-advance, no opponent)
 * - index: Bracket position following standard single-elimination indexing:
 *   - 1 = Finals
 *   - 2-3 = Semifinals
 *   - 4-7 = Quarterfinals
 *   - 8-15 = Round of 16
 *   - 16-31 = Round of 32 (Opening round for 24-player)
 *   - 0 = Consolation match (3rd/4th place)
 */
export interface MatchPlayGame {
  gameId: number;
  tournamentId: number;
  roundId: number;
  index: number; // Bracket position (see docs above)
  set: number;
  status: 'pending' | 'ready' | 'started' | 'completed';
  bye: boolean;
  playerIds: number[];
  userIds: (number | null)[];
  resultPositions: number[]; // Player IDs in finishing order [winner, loser, ...]
  resultPoints: string[]; // Points as strings, aligned with playerIds
  resultScores: (number | null)[];
  arenaId: number | null;
  bankId: number | null;
  challengeId: number | null;
  playerIdAdvantage: number | null;
  scorekeeperId: number | null;
  startedAt: string | null;
  duration: number | null;
  resultCountMismatch: boolean;
  suggestions: unknown[];
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface MatchPlayApiResponse<T> {
  data: T;
}

export interface MatchPlayApiListResponse<T> {
  data: T[];
}

// ============================================================================
// Error Types
// ============================================================================

export interface MatchPlayApiError {
  message: string;
  status: number;
  code?: string;
}

export class MatchPlayError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'MatchPlayError';
    this.status = status;
    this.code = code;
  }
}
