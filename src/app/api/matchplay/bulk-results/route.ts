import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMatchPlayClient, safeMatchPlayCall, mapMatchPlayGames } from '@/lib/matchplay';
import { recalculateScores } from '@/lib/scoring';

// Rate limiting: delay between Match Play API calls to avoid overwhelming their servers
const FETCH_DELAY_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TournamentSyncResult {
  tournamentId: string;
  tournamentName: string;
  imported: number;
  skipped: number;
  error?: string;
}

interface BulkSyncResponse {
  success: boolean;
  tournaments: TournamentSyncResult[];
  totalImported: number;
  totalSkipped: number;
  error?: string;
}

/**
 * POST /api/matchplay/bulk-results
 *
 * Sync results from Match Play for all tournaments that have a matchplay_id.
 * Designed for manual triggering and future cron automation.
 */
export async function POST(): Promise<NextResponse<BulkSyncResponse>> {
  const supabase = await createClient();

  // Verify authentication and admin status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        totalSkipped: 0,
        error: 'Not authenticated',
      },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        totalSkipped: 0,
        error: 'Not authorized',
      },
      { status: 403 }
    );
  }

  // Find all tournaments with Match Play IDs
  const { data: tournaments, error: fetchError } = await supabase
    .from('tournaments')
    .select('id, name, matchplay_id, player_count')
    .not('matchplay_id', 'is', null);

  if (fetchError) {
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        totalSkipped: 0,
        error: 'Failed to fetch tournaments',
      },
      { status: 500 }
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({
      success: true,
      tournaments: [],
      totalImported: 0,
      totalSkipped: 0,
    });
  }

  // Create Match Play client - fail fast if token is missing
  let client;
  try {
    client = createMatchPlayClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize Match Play client';
    console.error('[Match Play] Client initialization failed:', error);
    return NextResponse.json(
      {
        success: false,
        tournaments: [],
        totalImported: 0,
        totalSkipped: 0,
        error: message,
      },
      { status: 500 }
    );
  }

  const results: TournamentSyncResult[] = [];
  let totalImported = 0;
  let totalSkipped = 0;

  // Process each tournament with rate limiting
  for (let i = 0; i < tournaments.length; i++) {
    const tournament = tournaments[i];
    const result: TournamentSyncResult = {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      imported: 0,
      skipped: 0,
    };

    // Validate player_count
    if (tournament.player_count !== 16 && tournament.player_count !== 24) {
      result.error = 'Invalid player count';
      results.push(result);
      continue;
    }

    // matchplay_id is guaranteed non-null by query filter, but check anyway
    if (!tournament.matchplay_id) {
      results.push(result);
      continue;
    }

    const matchplayId = String(tournament.matchplay_id);

    // Fetch completed games and players from Match Play with standardized error handling
    const [gamesResult, playersResult] = await Promise.all([
      safeMatchPlayCall(() => client.getCompletedGames(matchplayId), 'fetch games'),
      safeMatchPlayCall(() => client.getTournamentWithPlayers(matchplayId), 'fetch players'),
    ]);

    if (!gamesResult.success) {
      result.error = gamesResult.error;
      results.push(result);
      continue;
    }

    if (!playersResult.success) {
      result.error = playersResult.error;
      results.push(result);
      continue;
    }

    const games = gamesResult.data;

    if (games.length === 0) {
      results.push(result);
      continue;
    }

    const playerCount = tournament.player_count;
    const { results: mappedResults, skipped } = mapMatchPlayGames(
      games,
      playersResult.data.players,
      playerCount
    );

    result.skipped = skipped.length;
    totalSkipped += skipped.length;

    // Save results to database
    for (const mappedResult of mappedResults) {
      const { error: upsertError } = await supabase.from('results').upsert(
        {
          tournament_id: tournament.id,
          round: mappedResult.round,
          match_position: mappedResult.match_position,
          winner_seed: mappedResult.winner_seed,
          loser_seed: mappedResult.loser_seed,
          winner_games: mappedResult.winner_games,
          loser_games: mappedResult.loser_games,
        },
        {
          onConflict: 'tournament_id,round,match_position',
        }
      );

      if (!upsertError) {
        result.imported++;
        totalImported++;
      }
    }

    // Recalculate scores for this tournament
    if (result.imported > 0) {
      await recalculateScores(tournament.id);
    }

    results.push(result);

    // Rate limit: delay before next tournament (except for last one)
    if (i < tournaments.length - 1) {
      await sleep(FETCH_DELAY_MS);
    }
  }

  return NextResponse.json({
    success: true,
    tournaments: results,
    totalImported,
    totalSkipped,
  });
}
