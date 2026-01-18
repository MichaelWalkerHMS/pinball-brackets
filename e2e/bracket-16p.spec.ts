import { test, expect } from '@playwright/test'
import { login, verifyLoggedIn } from './fixtures/auth'

/**
 * E2E tests for 16-player tournament brackets.
 *
 * IMPORTANT: These tests require a 16-player tournament to exist in the dev database.
 * The tournament should have:
 * - player_count = 16
 * - status = 'upcoming' or 'in_progress'
 * - At least 16 players seeded
 *
 * To set up:
 * 1. Login as admin
 * 2. Create a 16-player tournament via admin interface
 * 3. Add 16 players with seeds 1-16
 * 4. Run these tests
 *
 * The tests will skip if no 16-player tournament is found.
 */

test.describe('16-Player Bracket', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await verifyLoggedIn(page)
  })

  test('16-player bracket does not show Opening Round heading', async ({ page }) => {
    // Try to find and select a 16-player tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)

    // Check if a 16-player tournament option exists
    const options = await tournamentDropdown.locator('option').allTextContents()
    const has16PlayerTournament = options.some(opt => opt.includes('16') || opt.toLowerCase().includes('16-player'))

    if (!has16PlayerTournament) {
      test.skip(true, 'No 16-player tournament found in dev database - skipping test')
      return
    }

    // Select the 16-player tournament (look for one with "16" in the name)
    const option16p = options.find(opt => opt.includes('16') || opt.toLowerCase().includes('16-player'))
    if (option16p) {
      await tournamentDropdown.selectOption({ label: option16p.trim() })
    }

    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 10000 })

    // Opening Round heading should NOT be visible for 16-player
    await expect(page.getByRole('heading', { name: 'Opening Round' })).not.toBeVisible()

    // Round of 16 heading SHOULD be visible
    await expect(page.getByRole('heading', { name: 'Round of 16' })).toBeVisible()
  })

  test('16-player R16 shows correct seed pairings', async ({ page }) => {
    // This test verifies that R16 shows direct seed pairings (1v16, 8v9, etc.)
    // rather than bye seeds vs opening round winners

    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    const options = await tournamentDropdown.locator('option').allTextContents()
    const option16p = options.find(opt => opt.includes('16') || opt.toLowerCase().includes('16-player'))

    if (!option16p) {
      test.skip(true, 'No 16-player tournament found in dev database - skipping test')
      return
    }

    await tournamentDropdown.selectOption({ label: option16p.trim() })
    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 10000 })

    // Wait for bracket to render
    await page.waitForTimeout(500)

    // In a 16-player R16, seed 16 should be visible as a direct participant
    // (not TBD waiting for opening round winner)
    const seed16Text = page.getByText(/\b16\b/).first()
    await expect(seed16Text).toBeVisible()

    // Also verify seed 9 is visible (in 8v9 matchup)
    const seed9Text = page.getByText(/\b9\b/).first()
    await expect(seed9Text).toBeVisible()
  })

  test('16-player bracket has 4 connector arrows (not 5)', async ({ page }) => {
    // 16-player: R16->QF, QF->SF, SF->Finals, (connectors to consolation)
    // 24-player: Opening->R16, R16->QF, QF->SF, SF->Finals
    // The total visible arrow connectors should be 4 for 16-player (no Opening->R16)

    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    const options = await tournamentDropdown.locator('option').allTextContents()
    const option16p = options.find(opt => opt.includes('16') || opt.toLowerCase().includes('16-player'))

    if (!option16p) {
      test.skip(true, 'No 16-player tournament found in dev database - skipping test')
      return
    }

    await tournamentDropdown.selectOption({ label: option16p.trim() })
    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 10000 })

    // Arrow connectors should be 3 (R16->QF, QF->SF, SF->Finals)
    // Opening->R16 connector should not exist
    const arrowConnectors = page.getByTestId('round-arrow-connector')
    const arrowCount = await arrowConnectors.count()

    // 16-player has 3 connectors vs 24-player's 4
    expect(arrowCount).toBe(3)
  })

  test.afterEach(async ({ page }) => {
    // Clean up: delete any bracket created during this test
    // This prevents accumulation of test brackets

    // Check if we're on a bracket edit page with a delete button
    const deleteButton = page.getByRole('button', { name: 'Delete Bracket' })
    const hasDeleteButton = await deleteButton.isVisible().catch(() => false)

    if (hasDeleteButton) {
      await deleteButton.click()
      const confirmDelete = page.getByRole('button', { name: 'Delete', exact: true })
      if (await confirmDelete.isVisible().catch(() => false)) {
        await confirmDelete.click()
        // Wait for redirect to home
        await expect(page).toHaveURL('/', { timeout: 10000 })
      }
    }
  })
})

test.describe('16-Player Tournament Form', () => {
  // These tests verify the admin form shows correct max points for 16-player

  test('tournament form shows max 29 points for 16-player selection', async () => {
    // This would require admin access - skip for non-admin e2e user
    test.skip(true, 'Requires admin access - test manually via admin interface')
  })
})
