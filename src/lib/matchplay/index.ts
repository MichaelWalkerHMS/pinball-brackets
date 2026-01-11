/**
 * Match Play Events API Integration
 *
 * Provides a client for interacting with the Match Play Events API
 * to fetch tournament data, players, and game results.
 */

export { MatchPlayClient, createMatchPlayClient } from './client';
export { MatchPlayError } from './types';
export type {
  MatchPlayTournament,
  MatchPlayTournamentWithPlayers,
  MatchPlayPlayer,
  MatchPlayGame,
  MatchPlayGamePlayer,
  MatchPlayApiResponse,
  MatchPlayApiListResponse,
  MatchPlayApiError,
} from './types';
