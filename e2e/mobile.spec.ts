import { test, expect, devices } from '@playwright/test'
import { login, navigateToBracketEditor, saveBracket } from './fixtures/auth'

// Configure mobile viewport (use project's browser, not webkit)
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13']
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })

test.describe('Mobile', () => {
  // Skip on Firefox - isMobile option is not supported
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox does not support isMobile')

  test('homepage loads on mobile viewport', async ({ page }) => {
    // Logged-out users see tournament wizard
    await page.goto('/')

    // Should see wizard with dropdowns
    await expect(page.getByRole('heading', { name: 'Explore Tournaments' })).toBeVisible()
    await expect(page.getByText('Select State')).toBeVisible()
    await expect(page.getByText('Select Tournament')).toBeVisible()
  })

  test('can navigate to tournament on mobile', async ({ page }) => {
    // Logged-out users use wizard to navigate
    await page.goto('/')

    // Select state and tournament via wizard
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Tap View Leaderboard to navigate
    await page.getByRole('button', { name: 'View Leaderboard' }).tap()

    // Should be on tournament page
    await expect(page).toHaveURL(/\/tournament\//, { timeout: 10000 })
  })

  test('bracket is accessible on mobile', async ({ page }) => {
    await login(page)
    // On mobile, Log Out is inside hamburger menu - open it first
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible({ timeout: 10000 })
    // Close menu before continuing
    await page.getByRole('button', { name: 'Menu' }).click()

    // Navigate to bracket editor via dashboard
    await navigateToBracketEditor(page)

    // Bracket should load (navigateToBracketEditor already checks this)
  })

  test('can make picks on mobile', async ({ page }) => {
    await login(page)
    // On mobile, Log Out is inside hamburger menu - open it first
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible({ timeout: 10000 })
    // Close menu before continuing
    await page.getByRole('button', { name: 'Menu' }).click()

    // Navigate to bracket editor via dashboard
    await navigateToBracketEditor(page)

    // Find and tap a player slot
    const playerSlots = page.locator('[class*="cursor-pointer"]').filter({ hasText: /\d+\.\s+\w+/ })
    const firstSlot = playerSlots.first()

    if (await firstSlot.isVisible()) {
      await firstSlot.tap()
    }

    // Save bracket using helper (click works on mobile too)
    await saveBracket(page)
  })

  test('login form works on mobile', async ({ page }) => {
    await page.goto('/login')

    // Form should be visible and usable
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
  })
})
