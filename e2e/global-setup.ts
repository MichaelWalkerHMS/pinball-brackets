import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

/**
 * Collect all test user IDs from environment variables.
 * Looks for E2E_TEST_USER_ID_0, E2E_TEST_USER_ID_1, etc.
 */
function getTestUserIds(): string[] {
  const userIds: string[] = []
  for (let i = 0; i < 10; i++) {
    const userId = process.env[`E2E_TEST_USER_ID_${i}`]
    if (userId) {
      userIds.push(userId)
    }
  }
  return userIds
}

export default async function globalSetup() {
  // Load test environment variables
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
  const testUserIds = getTestUserIds()

  if (!supabaseUrl || !supabaseServiceKey || testUserIds.length === 0) {
    console.warn(
      'Skipping test user cleanup - missing environment variables.\n' +
      'For full E2E tests, ensure .env.test contains:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- SUPABASE_SERVICE_KEY\n' +
      '- E2E_TEST_USER_ID_0 (and _1, _2, etc. for parallel workers)'
    )
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Clean slate before tests run - delete all test users' brackets
  // (picks cascade delete with brackets)
  console.log(`Cleaning up data for ${testUserIds.length} test user(s)...`)

  // Delete brackets for all test users
  for (const userId of testUserIds) {
    const { error: bracketsError } = await supabase
      .from('brackets')
      .delete()
      .eq('user_id', userId)

    if (bracketsError) {
      console.warn(`Warning: Could not delete brackets for user ${userId}:`, bracketsError.message)
    }
  }

  console.log('Test user data cleanup complete')

  // Seed test results for score indicator tests
  console.log('Seeding test results for score indicator tests...')

  const { data: testTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('name', '2026 Michigan Test')
    .single()

  if (testTournament) {
    // Seed a few opening round results for testing score indicators
    // Opening round matches: 9v24, 10v23, 11v22, 12v21, 13v20, 14v19, 15v18, 16v17
    const { error: resultsError } = await supabase.from('results').upsert([
      { tournament_id: testTournament.id, round: 0, match_position: 0, winner_seed: 9, loser_seed: 24, winner_games: 0, loser_games: 0 },
      { tournament_id: testTournament.id, round: 0, match_position: 1, winner_seed: 23, loser_seed: 10, winner_games: 0, loser_games: 0 },
      { tournament_id: testTournament.id, round: 0, match_position: 2, winner_seed: 11, loser_seed: 22, winner_games: 0, loser_games: 0 },
    ], { onConflict: 'tournament_id,round,match_position' })

    if (resultsError) {
      console.warn('Warning: Could not seed results:', resultsError.message)
    } else {
      console.log('Test results seeded successfully')
    }
  } else {
    console.warn('Warning: Test tournament not found, skipping result seeding')
  }
}
