import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { IfpaClient, IfpaError, buildHeadToHead } from '@/lib/ifpa';
import type { IfpaPlayer, IfpaPvpEvent } from '@/lib/ifpa';

const IFPA_BASE_URL = 'https://api.ifpapinball.com';

function makePlayer(id: string, open: Partial<{ current_rank: string; ratings_value: string }>, mpRating?: string): IfpaPlayer {
  return {
    player_id: id,
    first_name: 'Test',
    last_name: `Player ${id}`,
    profile_photo: null,
    matchplay_events: mpRating === undefined ? null : { id: '1', rating: mpRating, rank: '1' },
    player_stats: {
      system: {
        open: { current_rank: '', ratings_rank: '', ratings_value: '', ...open },
      },
    },
  };
}

function makeEvent(date: string, p1: string, p2: string): IfpaPvpEvent {
  return {
    tournament_name: `Event ${date}`,
    event_name: 'Main Tournament',
    tournament_id: '1',
    event_end_date: date,
    finish_position: { player_1: p1, player_2: p2 },
  };
}

describe('IfpaClient', () => {
  it('throws when no API key is configured', () => {
    vi.stubEnv('IFPA_API_KEY', '');
    try {
      expect(() => new IfpaClient()).toThrow(IfpaError);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requests multiple players with the api_key query parameter', async () => {
    let requestedUrl: URL | null = null;
    server.use(
      http.get(`${IFPA_BASE_URL}/player`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json({ player: [makePlayer('1', {})] });
      })
    );

    const players = await new IfpaClient('test-key').getPlayers([1, 2]);

    expect(players).toHaveLength(1);
    expect(requestedUrl!.searchParams.get('players')).toBe('1,2');
    expect(requestedUrl!.searchParams.get('api_key')).toBe('test-key');
  });

  it('returns no players when IFPA responds with null', async () => {
    server.use(http.get(`${IFPA_BASE_URL}/player`, () => HttpResponse.json(null)));

    await expect(new IfpaClient('test-key').getPlayers([999])).resolves.toEqual([]);
  });

  it('returns an empty pvp list when players have never met (HTTP 200 with code 404)', async () => {
    server.use(
      http.get(`${IFPA_BASE_URL}/player/1/pvp/2`, () =>
        HttpResponse.json({ message: 'These users have never played in the same tournament', code: '404' })
      )
    );

    await expect(new IfpaClient('test-key').getPvp(1, 2)).resolves.toEqual([]);
  });

  it('surfaces the IFPA error message and status', async () => {
    server.use(
      http.get(`${IFPA_BASE_URL}/player/1/pvp/2`, () =>
        HttpResponse.json({ error: 'API_KEY was not found' }, { status: 401 })
      )
    );

    await expect(new IfpaClient('bad-key').getPvp(1, 2)).rejects.toMatchObject({
      message: 'API_KEY was not found',
      status: 401,
    });
  });

  it('handles non-JSON error responses', async () => {
    server.use(
      http.get(`${IFPA_BASE_URL}/player`, () => new HttpResponse('Bad Gateway', { status: 502 }))
    );

    await expect(new IfpaClient('test-key').getPlayers([1])).rejects.toMatchObject({ status: 502 });
  });
});

describe('buildHeadToHead', () => {
  it('maps stats per requested player regardless of response order', () => {
    const result = buildHeadToHead(
      1,
      2,
      [makePlayer('2', { current_rank: '92', ratings_value: '1801.23' }, '1675'), makePlayer('1', { current_rank: '678', ratings_value: '1771.6' }, '1535')],
      []
    );

    expect(result.player1).toEqual({ ifpaId: 1, ifpaRank: 678, ifpaRating: 1772, matchplayRating: 1535 });
    expect(result.player2).toEqual({ ifpaId: 2, ifpaRank: 92, ifpaRating: 1801, matchplayRating: 1675 });
  });

  it('treats unranked, unrated, and missing players as null', () => {
    const result = buildHeadToHead(1, 2, [makePlayer('1', { current_rank: '0', ratings_value: '' })], []);

    expect(result.player1).toEqual({ ifpaId: 1, ifpaRank: null, ifpaRating: null, matchplayRating: null });
    expect(result.player2).toEqual({ ifpaId: 2, ifpaRank: null, ifpaRating: null, matchplayRating: null });
  });

  it('returns no record when a player has no IFPA ID', () => {
    const result = buildHeadToHead(1, null, [makePlayer('1', { current_rank: '92' })], null);

    expect(result.player1?.ifpaRank).toBe(92);
    expect(result.player2).toBeNull();
    expect(result.record).toBeNull();
    expect(result.recentMeetings).toEqual([]);
  });

  it('tallies a win for whoever finished higher (lower position) and returns most recent meetings first', () => {
    const pvp = [
      makeEvent('2023-01-01', '6', '1'),
      makeEvent('2026-06-01', '2', '9'),
      makeEvent('2024-03-01', '4', '4'),
      makeEvent('2025-01-01', '10', '3'),
      makeEvent('2022-01-01', '1', '2'),
      makeEvent('2021-01-01', '5', '8'),
    ];

    const result = buildHeadToHead(1, 2, [], pvp);

    expect(result.record).toEqual({ player1Wins: 3, player2Wins: 2, ties: 1 });
    expect(result.recentMeetings.map((m) => m.date)).toEqual([
      '2026-06-01',
      '2025-01-01',
      '2024-03-01',
      '2023-01-01',
      '2022-01-01',
    ]);
  });
});
