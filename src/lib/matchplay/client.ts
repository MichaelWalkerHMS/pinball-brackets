import {
  MatchPlayTournament,
  MatchPlayTournamentWithPlayers,
  MatchPlayGame,
  MatchPlayApiResponse,
  MatchPlayApiListResponse,
  MatchPlayError,
} from './types';

/**
 * Result type for safeMatchPlayCall wrapper
 */
export type SafeMatchPlayResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

/**
 * Wrapper for Match Play API calls with standardized error handling.
 *
 * Provides consistent error handling across all Match Play API routes:
 * - Logs errors with context for debugging
 * - Handles MatchPlayError with appropriate status codes
 * - Falls back to 502 Bad Gateway for unexpected errors
 *
 * @param fn - Async function that calls Match Play API
 * @param actionName - Description of the action for error messages (e.g., "fetch games")
 * @returns Object with either { success: true, data } or { success: false, error, status }
 *
 * @example
 * const result = await safeMatchPlayCall(
 *   () => client.getCompletedGames(matchplayId),
 *   'fetch games'
 * );
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: result.status });
 * }
 * const games = result.data;
 */
export async function safeMatchPlayCall<T>(
  fn: () => Promise<T>,
  actionName: string
): Promise<SafeMatchPlayResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    // nosemgrep: unsafe-formatstring -- actionName is a hardcoded string from our code
    console.error(`[Match Play] ${actionName} failed:`, err);

    if (err instanceof MatchPlayError) {
      return {
        success: false,
        error: err.message,
        status: err.status,
      };
    }

    // Generic fallback for unexpected errors
    return {
      success: false,
      error: `Failed to ${actionName} from Match Play`,
      status: 502,
    };
  }
}

/**
 * Match Play Events API Client
 *
 * Provides methods to interact with the Match Play Events API for:
 * - Fetching tournament details
 * - Fetching players with seeds
 * - Fetching game results
 *
 * Usage:
 *   const client = new MatchPlayClient();
 *   const tournament = await client.getTournament('12345');
 */
export class MatchPlayClient {
  private readonly baseUrl = 'https://app.matchplay.events/api';
  private readonly token: string;

  constructor(token?: string) {
    const apiToken = token ?? process.env.MATCHPLAY_API_TOKEN;
    if (!apiToken) {
      throw new MatchPlayError(
        'MATCHPLAY_API_TOKEN environment variable is not set',
        500,
        'MISSING_TOKEN'
      );
    }
    this.token = apiToken;
  }

  /**
   * Fetch a tournament by ID
   */
  async getTournament(id: string): Promise<MatchPlayTournament> {
    const response = await this.fetch<MatchPlayApiResponse<MatchPlayTournament>>(
      `/tournaments/${id}`
    );
    return response.data;
  }

  /**
   * Fetch a tournament with its players and seeds
   */
  async getTournamentWithPlayers(id: string): Promise<MatchPlayTournamentWithPlayers> {
    const response = await this.fetch<MatchPlayApiResponse<MatchPlayTournamentWithPlayers>>(
      `/tournaments/${id}?includePlayers=true`
    );
    return response.data;
  }

  /**
   * Fetch games for a tournament, optionally filtered by status
   */
  async getGames(
    tournamentId: string,
    status?: 'pending' | 'ready' | 'started' | 'completed'
  ): Promise<MatchPlayGame[]> {
    const params = status ? `?status=${status}` : '';
    const response = await this.fetch<MatchPlayApiListResponse<MatchPlayGame>>(
      `/tournaments/${tournamentId}/games${params}`
    );
    return response.data;
  }

  /**
   * Fetch only completed games for a tournament (convenience method for results sync)
   */
  async getCompletedGames(tournamentId: string): Promise<MatchPlayGame[]> {
    return this.getGames(tournamentId, 'completed');
  }

  /**
   * Internal fetch wrapper with authentication and error handling
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await this.parseErrorBody(response);
      throw new MatchPlayError(
        errorBody.message || `Match Play API error: ${response.statusText}`,
        response.status,
        errorBody.code
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Attempt to parse error response body, falling back to status text
   */
  private async parseErrorBody(
    response: Response
  ): Promise<{ message?: string; code?: string }> {
    try {
      const body = await response.json();
      return {
        message: body.message || body.error || response.statusText,
        code: body.code,
      };
    } catch {
      return { message: response.statusText };
    }
  }
}

/**
 * Create a Match Play client instance
 * Convenience function for one-off API calls
 */
export function createMatchPlayClient(token?: string): MatchPlayClient {
  return new MatchPlayClient(token);
}
