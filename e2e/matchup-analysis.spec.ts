import { test, expect } from '@playwright/test'
import { login, verifyLoggedIn } from './fixtures/auth'

// Requires a tournament whose players were imported from Match Play (so they have
// IFPA IDs). Skips if the dev database doesn't have one for this state.
const STATE_WITH_IFPA_PLAYERS = 'Georgia'

// The IFPA route is mocked so CI doesn't need an IFPA key or depend on live rankings
const mockHeadToHead = {
  player1: { ifpaId: 1, ifpaRank: 490, ifpaRating: 1766, matchplayRating: 1705 },
  player2: { ifpaId: 2, ifpaRank: 2668, ifpaRating: 1434, matchplayRating: 1630 },
  record: { player1Wins: 27, player2Wins: 5, ties: 1 },
  recentMeetings: [
    { tournamentName: 'Test Open', date: '2026-01-17', player1Finish: 2, player2Finish: 12 },
  ],
}

test.describe('Matchup Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await verifyLoggedIn(page)
  })

  test('opens IFPA head-to-head modal from a matchup', async ({ page }) => {
    await page.route('**/api/ifpa/head-to-head?**', (route) => route.fulfill({ json: mockHeadToHead }))

    const stateDropdown = page.locator('select').first()
    const states = await stateDropdown.locator('option').allTextContents()
    test.skip(!states.includes(STATE_WITH_IFPA_PLAYERS), `No ${STATE_WITH_IFPA_PLAYERS} tournament in dev DB`)

    await stateDropdown.selectOption({ label: STATE_WITH_IFPA_PLAYERS })
    await page.locator('select').nth(1).selectOption({ index: 1 })
    await expect(page.getByPlaceholder('Enter bracket name')).toHaveValue(/.+/, { timeout: 5000 })
    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: 'Opening Round' }).or(
        page.getByRole('heading', { name: 'Round of 16' })
      ).first()
    ).toBeVisible()

    // Opening-round matches always have both players, so their analysis buttons are visible
    await page.getByRole('button', { name: 'Matchup Analysis' }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Matchup Analysis' })
    await expect(dialog).toBeVisible()
    test.skip(
      await dialog.getByText('No IFPA Number Found').first().isVisible(),
      'Tournament players have no IFPA IDs in dev DB'
    )
    await expect(dialog.getByText('#490')).toBeVisible()
    await expect(dialog.getByText('27 – 5')).toBeVisible()
    await expect(dialog.getByText('Test Open')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
