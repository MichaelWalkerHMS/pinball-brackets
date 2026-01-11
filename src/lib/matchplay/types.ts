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
  type: string; // e.g., 'single_elimination', 'double_elimination', etc.
  organizerId: number;
  venueId: number | null;
  venueName: string | null;
  createdAt: string;
  updatedAt: string;
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
  seed: number | null;
  status: 'active' | 'withdrawn' | 'eliminated';
  ifpaId: number | null;
  claimedBy: number | null; // User ID who claimed this player profile
}

// ============================================================================
// Game/Match Types
// ============================================================================

export interface MatchPlayGame {
  gameId: number;
  tournamentId: number;
  round: number;
  gameNumber: number; // Position within the round
  status: 'pending' | 'ready' | 'started' | 'completed';
  arenaId: number | null;
  arenaName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  players: MatchPlayGamePlayer[];
}

export interface MatchPlayGamePlayer {
  playerId: number;
  seed: number;
  points: number;
  result: 'win' | 'loss' | null;
  position: number; // Finishing position (1 = winner, 2 = loser for head-to-head)
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
