import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMatchPlayClient, safeMatchPlayCall, mapMatchPlayGames, countResultsByRound } from '@/lib/matchplay';
import { recalculateScores } from '@/lib/scoring';
import { ROUND_NAMES } from '@/lib/bracket/constants';

interface SyncResultsRequest {
  tournamentId: string;
}

interface SyncResultsResponse {
  success: boolean;
  imported: number;
  skipped: number;
  byRound: Record<string, number>;
  error?: string;
}

/**
 * POST /api/matchplay/results
 *
 * Sync results from Match Play for a single tournament.
 * Fetches completed games and players from Match Play,
 * maps them to our internal format, and saves to database.
 */
export async function POST(request: NextRequest): Promise<NextResponse<SyncResultsResponse>> {
  const supabase = await createClient();

  // Verify authentication and admin status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Not authenticated' },
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
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Not authorized' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: SyncResultsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { tournamentId } = body;

  if (!tournamentId) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Tournament ID required' },
      { status: 400 }
    );
  }

  // Fetch tournament from database
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, matchplay_id, player_count, status')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Tournament not found' },
      { status: 404 }
    );
  }

  if (!tournament.matchplay_id) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Tournament has no Match Play ID' },
      { status: 400 }
    );
  }

  if (tournament.player_count !== 16 && tournament.player_count !== 24) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Invalid player count (must be 16 or 24)' },
      { status: 400 }
    );
  }

  const playerCount = tournament.player_count;
  const matchplayId = String(tournament.matchplay_id);

  // Fetch completed games and players from Match Play with standardized error handling
  // Note: Client is created inside lambdas so constructor errors are caught by the wrapper
  const [gamesResult, playersResult] = await Promise.all([
    safeMatchPlayCall(() => createMatchPlayClient().getCompletedGames(matchplayId), 'fetch games'),
    safeMatchPlayCall(() => createMatchPlayClient().getTournamentWithPlayers(matchplayId), 'fetch players'),
  ]);

  if (!gamesResult.success) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: gamesResult.error },
      { status: gamesResult.status }
    );
  }

  if (!playersResult.success) {
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, byRound: {}, error: playersResult.error },
      { status: playersResult.status }
    );
  }

  const games = gamesResult.data;
  const players = playersResult.data.players;

  if (games.length === 0) {
    return NextResponse.json({
      success: true,
      imported: 0,
      skipped: 0,
      byRound: {},
    });
  }

  // Map Match Play games to our format
  const { results, skipped } = mapMatchPlayGames(games, players, playerCount);

  if (results.length === 0) {
    return NextResponse.json({
      success: true,
      imported: 0,
      skipped: skipped.length,
      byRound: {},
    });
  }

  // Save results to database (upsert to handle re-syncs)
  let importedCount = 0;
  const errors: string[] = [];

  for (const result of results) {
    const { error: upsertError } = await supabase.from('results').upsert(
      {
        tournament_id: tournamentId,
        round: result.round,
        match_position: result.match_position,
        winner_seed: result.winner_seed,
        loser_seed: result.loser_seed,
        winner_games: result.winner_games,
        loser_games: result.loser_games,
      },
      {
        onConflict: 'tournament_id,round,match_position',
      }
    );

    if (upsertError) {
      errors.push(`Round ${result.round}, Position ${result.match_position}: ${upsertError.message}`);
    } else {
      importedCount++;
    }
  }

  // If tournament was upcoming and we imported results, transition to in_progress
  if (tournament.status === 'upcoming' && importedCount > 0) {
    const { error: statusError } = await supabase
      .from('tournaments')
      .update({ status: 'in_progress' })
      .eq('id', tournamentId);

    if (statusError) {
      console.warn('Failed to transition tournament status to in_progress:', statusError.message);
    }
  }

  // Recalculate bracket scores
  await recalculateScores(tournamentId);

  // Build response with counts by round
  const roundCounts = countResultsByRound(results);
  const byRound: Record<string, number> = {};
  for (const [round, count] of Object.entries(roundCounts)) {
    const roundName = ROUND_NAMES[parseInt(round)] || `Round ${round}`;
    if (count > 0) {
      byRound[roundName] = count;
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    imported: importedCount,
    skipped: skipped.length,
    byRound,
    error: errors.length > 0 ? `Some results failed: ${errors.join('; ')}` : undefined,
  });
}
