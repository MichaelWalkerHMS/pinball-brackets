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

  // Clear ALL results to ensure bracket creation works for any tournament
  // (has_results is computed from results count, so clearing results unlocks tournaments)
  // This is safe because this is the dev database used only for testing
  console.log('Clearing all tournament results...')

  const { error: clearError } = await supabase
    .from('results')
    .delete()
    .neq('tournament_id', '00000000-0000-0000-0000-000000000000') // Delete all (no-op condition)

  if (clearError) {
    console.warn('Warning: Could not clear tournament results:', clearError.message)
  } else {
    console.log('Tournament results cleared successfully')
  }
}
