import { describe, it, expect } from 'vitest';
import {
  mapMatchPlayPlayers,
  comparePlayerLists,
  hasDiffChanges,
} from '@/lib/matchplay/playerMapper';
import type { MatchPlayPlayer } from '@/lib/matchplay/types';

describe('mapMatchPlayPlayers', () => {
  it('converts 0-indexed seeds to 1-indexed', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 1,
        name: 'First Seed',
        status: 'active',
        ifpaId: 100,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
      {
        playerId: 2,
        name: 'Second Seed',
        status: 'active',
        ifpaId: 200,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 1, pointsAdjustment: 0 },
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'First Seed',
      seed: 1, // 0 + 1
      matchplay_id: '1',
      ifpa_id: 100,
    });
    expect(result[1]).toEqual({
      name: 'Second Seed',
      seed: 2, // 1 + 1
      matchplay_id: '2',
      ifpa_id: 200,
    });
  });

  it('filters out players without tournamentPlayer data', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 1,
        name: 'Has Seed',
        status: 'active',
        ifpaId: 100,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
      {
        playerId: 2,
        name: 'No Tournament Data',
        status: 'active',
        ifpaId: 200,
        claimedBy: null,
        // No tournamentPlayer
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Has Seed');
  });

  it('filters out players with null seed', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 1,
        name: 'Has Seed',
        status: 'active',
        ifpaId: 100,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
      {
        playerId: 2,
        name: 'Null Seed',
        status: 'active',
        ifpaId: 200,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: null, pointsAdjustment: 0 },
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Has Seed');
  });

  it('filters out non-active players based on tournamentPlayer status', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 1,
        name: 'Active Player',
        status: 'active',
        ifpaId: 100,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
      {
        playerId: 2,
        name: 'Withdrawn Player',
        status: 'active', // top-level status might still be active
        ifpaId: 200,
        claimedBy: null,
        tournamentPlayer: { status: 'withdrawn', seed: 1, pointsAdjustment: 0 },
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Active Player');
  });

  it('sorts players by seed', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 3,
        name: 'Third',
        status: 'active',
        ifpaId: 300,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 2, pointsAdjustment: 0 },
      },
      {
        playerId: 1,
        name: 'First',
        status: 'active',
        ifpaId: 100,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
      {
        playerId: 2,
        name: 'Second',
        status: 'active',
        ifpaId: 200,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 1, pointsAdjustment: 0 },
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result[0].seed).toBe(1);
    expect(result[0].name).toBe('First');
    expect(result[1].seed).toBe(2);
    expect(result[1].name).toBe('Second');
    expect(result[2].seed).toBe(3);
    expect(result[2].name).toBe('Third');
  });

  it('handles null ifpaId', () => {
    const players: MatchPlayPlayer[] = [
      {
        playerId: 1,
        name: 'No IFPA',
        status: 'active',
        ifpaId: null,
        claimedBy: null,
        tournamentPlayer: { status: 'active', seed: 0, pointsAdjustment: 0 },
      },
    ];

    const result = mapMatchPlayPlayers(players);

    expect(result[0].ifpa_id).toBeNull();
  });
});

describe('comparePlayerLists', () => {
  it('detects added players', () => {
    const current = [
      { name: 'Player A', seed: 1, matchplay_id: '1' },
    ];
    const mpPlayers = [
      { name: 'Player A', seed: 1, matchplay_id: '1', ifpa_id: null },
      { name: 'Player B', seed: 2, matchplay_id: '2', ifpa_id: null },
    ];

    const diff = comparePlayerLists(current, mpPlayers);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].name).toBe('Player B');
  });

  it('detects removed players', () => {
    const current = [
      { name: 'Player A', seed: 1, matchplay_id: '1' },
      { name: 'Player B', seed: 2, matchplay_id: '2' },
    ];
    const mpPlayers = [
      { name: 'Player A', seed: 1, matchplay_id: '1', ifpa_id: null },
    ];

    const diff = comparePlayerLists(current, mpPlayers);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].name).toBe('Player B');
  });

  it('detects reseeded players', () => {
    const current = [
      { name: 'Player A', seed: 1, matchplay_id: '1' },
    ];
    const mpPlayers = [
      { name: 'Player A', seed: 3, matchplay_id: '1', ifpa_id: null },
    ];

    const diff = comparePlayerLists(current, mpPlayers);

    expect(diff.reseeded).toHaveLength(1);
    expect(diff.reseeded[0]).toEqual({
      name: 'Player A',
      oldSeed: 1,
      newSeed: 3,
    });
  });

  it('detects renamed players', () => {
    const current = [
      { name: 'Old Name', seed: 1, matchplay_id: '1' },
    ];
    const mpPlayers = [
      { name: 'New Name', seed: 1, matchplay_id: '1', ifpa_id: null },
    ];

    const diff = comparePlayerLists(current, mpPlayers);

    expect(diff.renamed).toHaveLength(1);
    expect(diff.renamed[0]).toEqual({
      matchplayId: '1',
      oldName: 'Old Name',
      newName: 'New Name',
      seed: 1,
    });
  });

  it('returns empty diff when no changes', () => {
    const current = [
      { name: 'Player A', seed: 1, matchplay_id: '1' },
    ];
    const mpPlayers = [
      { name: 'Player A', seed: 1, matchplay_id: '1', ifpa_id: null },
    ];

    const diff = comparePlayerLists(current, mpPlayers);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.reseeded).toHaveLength(0);
    expect(diff.renamed).toHaveLength(0);
  });
});

describe('hasDiffChanges', () => {
  it('returns false for empty diff', () => {
    const diff = { added: [], removed: [], reseeded: [], renamed: [] };
    expect(hasDiffChanges(diff)).toBe(false);
  });

  it('returns true when there are added players', () => {
    const diff = {
      added: [{ name: 'New', seed: 1, matchplay_id: '1', ifpa_id: null }],
      removed: [],
      reseeded: [],
      renamed: [],
    };
    expect(hasDiffChanges(diff)).toBe(true);
  });

  it('returns true when there are removed players', () => {
    const diff = {
      added: [],
      removed: [{ name: 'Gone', seed: 1 }],
      reseeded: [],
      renamed: [],
    };
    expect(hasDiffChanges(diff)).toBe(true);
  });

  it('returns true when there are reseeded players', () => {
    const diff = {
      added: [],
      removed: [],
      reseeded: [{ name: 'Moved', oldSeed: 1, newSeed: 2 }],
      renamed: [],
    };
    expect(hasDiffChanges(diff)).toBe(true);
  });

  it('returns true when there are renamed players', () => {
    const diff = {
      added: [],
      removed: [],
      reseeded: [],
      renamed: [{ matchplayId: '1', oldName: 'Old', newName: 'New', seed: 1 }],
    };
    expect(hasDiffChanges(diff)).toBe(true);
  });
});
