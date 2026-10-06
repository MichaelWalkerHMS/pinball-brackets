import {
  IfpaError,
  IfpaPlayer,
  IfpaPlayersResponse,
  IfpaPvpEvent,
  IfpaPvpResponse,
} from './types';

// IFPA rankings update monthly, so a few hours of caching is plenty fresh and
// keeps repeated modal opens from spending our API quota.
const REVALIDATE_SECONDS = 6 * 60 * 60;

/**
 * IFPA API Client (server-only: the API key is sent as a query parameter,
 * so these requests must never be made from the browser).
 */
export class IfpaClient {
  private readonly baseUrl = 'https://api.ifpapinball.com';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.IFPA_API_KEY;
    if (!key) {
      throw new IfpaError('IFPA_API_KEY environment variable is not set', 500, 'MISSING_KEY');
    }
    this.apiKey = key;
  }

  /**
   * Fetch multiple players in one request. Unknown IDs are omitted from the result.
   */
  async getPlayers(ids: number[]): Promise<IfpaPlayer[]> {
    const response = await this.fetch<IfpaPlayersResponse | null>(
      `/player?players=${ids.join(',')}`
    );
    return response?.player ?? [];
  }

  /**
   * Fetch every tournament both players attended, with each player's finish.
   * Returns an empty array when they have never played in the same event.
   */
  async getPvp(playerId: number, opponentId: number): Promise<IfpaPvpEvent[]> {
    const response = await this.fetch<IfpaPvpResponse>(
      `/player/${playerId}/pvp/${opponentId}`
    );
    return response.pvp ?? [];
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${separator}api_key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new IfpaError(await this.parseErrorMessage(response), response.status);
    }

    return response.json() as Promise<T>;
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      return body.error || body.message || `IFPA API error: ${response.statusText}`;
    } catch {
      return `IFPA API error: ${response.statusText}`;
    }
  }
}

export function createIfpaClient(apiKey?: string): IfpaClient {
  return new IfpaClient(apiKey);
}
