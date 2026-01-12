import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { MatchPlayClient, createMatchPlayClient, safeMatchPlayCall } from '@/lib/matchplay/client';
import { MatchPlayError } from '@/lib/matchplay/types';

const MATCHPLAY_BASE_URL = 'https://app.matchplay.events/api';

// Mock tournament response
const mockTournament = {
  tournamentId: 12345,
  name: 'Michigan State Championship 2026',
  status: 'started',
  startDate: '2026-01-17',
  endDate: '2026-01-19',
  type: 'single_elimination',
  organizerId: 100,
  venueId: 50,
  venueName: 'Pinball Pete\'s',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-10T00:00:00Z',
};

// Mock players (matching actual API structure)
const mockPlayers = [
  {
    playerId: 1001,
    name: 'Player One',
    status: 'active',
    ifpaId: 10001,
    claimedBy: null,
    tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
  },
  {
    playerId: 1002,
    name: 'Player Two',
    status: 'active',
    ifpaId: 10002,
    claimedBy: null,
    tournamentPlayer: { status: 'active', seed: 1, pointsAdjustment: 0 },
  },
  {
    playerId: 1003,
    name: 'Player Three',
    status: 'active',
    ifpaId: null,
    claimedBy: null,
    tournamentPlayer: { status: 'active', seed: 2, pointsAdjustment: 0 },
  },
];

// Mock games (matching actual API structure)
const mockGames = [
  {
    gameId: 5001,
    tournamentId: 12345,
    roundId: 100001,
    index: 17,
    set: 0,
    status: 'completed',
    bye: false,
    playerIds: [1016, 1017],
    userIds: [null, null],
    resultPositions: [1016, 1017],
    resultPoints: ['1.00', '0.00'],
    resultScores: [null, null],
    arenaId: 1,
    bankId: null,
    challengeId: null,
    playerIdAdvantage: null,
    scorekeeperId: null,
    startedAt: '2026-01-17T14:00:00Z',
    duration: 600,
    resultCountMismatch: false,
    suggestions: [],
  },
  {
    gameId: 5002,
    tournamentId: 12345,
    roundId: 100001,
    index: 18,
    set: 0,
    status: 'completed',
    bye: false,
    playerIds: [1009, 1024],
    userIds: [null, null],
    resultPositions: [1009, 1024],
    resultPoints: ['1.00', '0.00'],
    resultScores: [null, null],
    arenaId: 2,
    bankId: null,
    challengeId: null,
    playerIdAdvantage: null,
    scorekeeperId: null,
    startedAt: '2026-01-17T14:30:00Z',
    duration: 900,
    resultCountMismatch: false,
    suggestions: [],
  },
];

describe('MatchPlayClient', () => {
  const TEST_TOKEN = 'test-api-token';

  beforeEach(() => {
    vi.stubEnv('MATCHPLAY_API_TOKEN', TEST_TOKEN);
  });

  describe('constructor', () => {
    it('creates client with explicit token', () => {
      const client = new MatchPlayClient('explicit-token');
      expect(client).toBeInstanceOf(MatchPlayClient);
    });

    it('creates client with environment token', () => {
      const client = new MatchPlayClient();
      expect(client).toBeInstanceOf(MatchPlayClient);
    });

    it('throws MatchPlayError when no token available', () => {
      vi.stubEnv('MATCHPLAY_API_TOKEN', '');
      expect(() => new MatchPlayClient()).toThrow(MatchPlayError);
      expect(() => new MatchPlayClient()).toThrow('MATCHPLAY_API_TOKEN environment variable is not set');
    });
  });

  describe('getTournament', () => {
    it('fetches tournament by ID', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, () => {
          return HttpResponse.json({ data: mockTournament });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      const tournament = await client.getTournament('12345');

      expect(tournament.tournamentId).toBe(12345);
      expect(tournament.name).toBe('Michigan State Championship 2026');
      expect(tournament.status).toBe('started');
    });

    it('throws MatchPlayError on 404', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/99999`, () => {
          return HttpResponse.json(
            { message: 'Tournament not found' },
            { status: 404 }
          );
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      await expect(client.getTournament('99999')).rejects.toThrow(MatchPlayError);
      await expect(client.getTournament('99999')).rejects.toThrow('Tournament not found');
    });

    it('throws MatchPlayError on 401 unauthorized', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, () => {
          return HttpResponse.json(
            { message: 'Invalid API token' },
            { status: 401 }
          );
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      await expect(client.getTournament('12345')).rejects.toThrow(MatchPlayError);
    });
  });

  describe('getTournamentWithPlayers', () => {
    it('fetches tournament with players', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('includePlayers') === 'true') {
            return HttpResponse.json({
              data: { ...mockTournament, players: mockPlayers },
            });
          }
          return HttpResponse.json({ data: mockTournament });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      const tournament = await client.getTournamentWithPlayers('12345');

      expect(tournament.tournamentId).toBe(12345);
      expect(tournament.players).toHaveLength(3);
      expect(tournament.players[0].name).toBe('Player One');
      expect(tournament.players[0].tournamentPlayer?.seed).toBe(0);
    });
  });

  describe('getGames', () => {
    it('fetches all games for tournament', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345/games`, () => {
          return HttpResponse.json({ data: mockGames });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      const games = await client.getGames('12345');

      expect(games).toHaveLength(2);
      expect(games[0].gameId).toBe(5001);
      expect(games[0].playerIds).toHaveLength(2);
    });

    it('fetches completed games with status filter', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345/games`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('status') === 'completed') {
            return HttpResponse.json({ data: mockGames });
          }
          return HttpResponse.json({ data: [] });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      const games = await client.getGames('12345', 'completed');

      expect(games).toHaveLength(2);
    });
  });

  describe('getCompletedGames', () => {
    it('is a convenience method for getGames with completed status', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345/games`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('status')).toBe('completed');
          return HttpResponse.json({ data: mockGames });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);
      const games = await client.getCompletedGames('12345');

      expect(games).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('includes status code in MatchPlayError', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, () => {
          return HttpResponse.json(
            { message: 'Rate limit exceeded', code: 'RATE_LIMITED' },
            { status: 429 }
          );
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);

      try {
        await client.getTournament('12345');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MatchPlayError);
        const mpError = error as MatchPlayError;
        expect(mpError.status).toBe(429);
        expect(mpError.message).toBe('Rate limit exceeded');
        expect(mpError.code).toBe('RATE_LIMITED');
      }
    });

    it('handles non-JSON error responses', async () => {
      server.use(
        http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, () => {
          return new HttpResponse('Internal Server Error', { status: 500 });
        })
      );

      const client = new MatchPlayClient(TEST_TOKEN);

      try {
        await client.getTournament('12345');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MatchPlayError);
        const mpError = error as MatchPlayError;
        expect(mpError.status).toBe(500);
      }
    });
  });

  describe('createMatchPlayClient helper', () => {
    it('creates a client instance', () => {
      const client = createMatchPlayClient(TEST_TOKEN);
      expect(client).toBeInstanceOf(MatchPlayClient);
    });
  });
});

describe('safeMatchPlayCall', () => {
  beforeEach(() => {
    vi.stubEnv('MATCHPLAY_API_TOKEN', 'test-token');
  });

  it('returns success result when call succeeds', async () => {
    const mockData = { id: 123, name: 'Test' };
    const result = await safeMatchPlayCall(
      () => Promise.resolve(mockData),
      'test action'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockData);
    }
  });

  it('returns error result with MatchPlayError status', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await safeMatchPlayCall(
      () => Promise.reject(new MatchPlayError('Tournament not found', 404, 'NOT_FOUND')),
      'fetch tournament'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Tournament not found');
      expect(result.status).toBe(404);
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Match Play] fetch tournament failed:',
      expect.any(MatchPlayError)
    );

    consoleSpy.mockRestore();
  });

  it('returns 502 status for non-MatchPlayError exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await safeMatchPlayCall(
      () => Promise.reject(new Error('Network error')),
      'fetch games'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch games from Match Play');
      expect(result.status).toBe(502);
    }

    consoleSpy.mockRestore();
  });

  it('handles non-Error exceptions gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await safeMatchPlayCall(
      () => Promise.reject('string error'),
      'fetch data'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch data from Match Play');
      expect(result.status).toBe(502);
    }

    consoleSpy.mockRestore();
  });

  it('preserves MatchPlayError status codes like 429 rate limit', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await safeMatchPlayCall(
      () => Promise.reject(new MatchPlayError('Rate limited', 429, 'RATE_LIMITED')),
      'sync results'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(429);
      expect(result.error).toBe('Rate limited');
    }

    consoleSpy.mockRestore();
  });

  it('works with real client method calls', async () => {
    const TEST_TOKEN = 'test-api-token';

    server.use(
      http.get(`${MATCHPLAY_BASE_URL}/tournaments/12345`, () => {
        return HttpResponse.json({ data: mockTournament });
      })
    );

    const client = new MatchPlayClient(TEST_TOKEN);
    const result = await safeMatchPlayCall(
      () => client.getTournament('12345'),
      'fetch tournament'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Michigan State Championship 2026');
    }
  });
});
