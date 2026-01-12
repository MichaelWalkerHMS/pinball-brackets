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
  MatchPlayApiResponse,
  MatchPlayApiListResponse,
  MatchPlayApiError,
} from './types';

export {
  mapMatchPlayPlayers,
  comparePlayerLists,
  hasDiffChanges,
} from './playerMapper';
export type { MappedPlayer, PlayerDiff } from './playerMapper';
