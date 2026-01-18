import { test, expect } from '@playwright/test'
import { login, verifyLoggedIn } from './fixtures/auth'

test.describe('Dashboard', () => {
  test('logged out user sees tournament wizard and CTA', async ({ page }) => {
    await page.goto('/')

    // Should see the landing page with tournament wizard
    await expect(page.getByRole('heading', { name: 'Pinball Brackets' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Explore Tournaments' })).toBeVisible()

    // Should see the wizard dropdowns
    await expect(page.getByText('Select State')).toBeVisible()
    await expect(page.getByText('Select Tournament')).toBeVisible()

    // Should see login/signup CTAs (use .first() as there may be multiple Log In links)
    await expect(page.getByRole('link', { name: 'Log In' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign Up' }).first()).toBeVisible()
  })

  test('logged out user can select state and tournament in wizard', async ({ page }) => {
    await page.goto('/')

    // Select a state
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    // Tournament dropdown should now be enabled
    const tournamentDropdown = page.locator('select').nth(1)
    await expect(tournamentDropdown).toBeEnabled()

    // Select a tournament
    await tournamentDropdown.selectOption({ index: 1 })

    // Should see tournament details and action buttons
    await expect(page.getByText(/\d+ players/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'View Leaderboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Bracket' })).toBeVisible()
  })

  test('logged out user can view leaderboard from wizard', async ({ page }) => {
    await page.goto('/')

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Click View Leaderboard
    await page.getByRole('button', { name: 'View Leaderboard' }).click()

    // Should navigate to tournament page
    await expect(page).toHaveURL(/\/tournament\//, { timeout: 10000 })
  })

  test('logged out user sees auth modal when clicking Create Bracket', async ({ page }) => {
    await page.goto('/')

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Click Create Bracket
    await page.getByRole('button', { name: 'Create Bracket' }).click()

    // Should see auth modal with signup tab active by default
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible()
    await expect(page.getByLabel('Your Name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('auth modal can switch between login and signup tabs', async ({ page }) => {
    await page.goto('/')

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Click Create Bracket to open modal
    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Should start on signup tab (default for Create Bracket flow)
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible()

    // Switch to login tab
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()

    // Switch back to signup tab
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible()
  })

  test('auth modal can be closed', async ({ page }) => {
    await page.goto('/')

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Click Create Bracket to open modal
    await page.getByRole('button', { name: 'Create Bracket' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Close modal with X button
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('logged in user sees dashboard with My Brackets section', async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)

    // Should see dashboard sections
    await expect(page.getByRole('heading', { name: 'My Brackets' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Create New Bracket' })).toBeVisible()
  })

  test('logged in user sees Create Bracket wizard', async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)

    // Should see the initial wizard steps (steps 1 and 2)
    await expect(page.getByText('Select State')).toBeVisible()
    await expect(page.getByText('Select Tournament')).toBeVisible()

    // Step 3 (Bracket Name) only appears after selecting a tournament without results
    // Select a state and tournament to see the full wizard
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Now step 3 should be visible
    await expect(page.getByText('Bracket Name')).toBeVisible()

    // Create button should be enabled after tournament selection (name auto-populates)
    const createButton = page.getByRole('button', { name: 'Create Bracket' })
    await expect(createButton).toBeVisible()
    await expect(createButton).toBeEnabled()
  })

  test('can select state and tournament in wizard', async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)

    // Select a state
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    // Tournament dropdown should now be enabled
    const tournamentDropdown = page.locator('select').nth(1)
    await expect(tournamentDropdown).toBeEnabled()

    // Select a tournament
    await tournamentDropdown.selectOption({ index: 1 })

    // Bracket name should be auto-populated
    const bracketNameInput = page.getByPlaceholder('Enter bracket name')
    await expect(bracketNameInput).toHaveValue(/Michigan.*#\d+/)

    // Create button should be enabled
    const createButton = page.getByRole('button', { name: 'Create Bracket' })
    await expect(createButton).toBeEnabled()
  })

  test('tournament details appear when tournament selected', async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Tournament details should appear (player count, status)
    // Use .first() because player count appears in both My Brackets table and TournamentDetails
    await expect(page.getByText(/\d+ players/).first()).toBeVisible()
    // Tournament shows "Open" or "Locked" status
    await expect(page.getByText(/Open|Locked/i).first()).toBeVisible()
  })

  test('can create new bracket and navigate to edit page', async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)

    // Select a state and tournament
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: 'Michigan' })

    const tournamentDropdown = page.locator('select').nth(1)
    await tournamentDropdown.selectOption({ index: 1 })

    // Wait for bracket name to be populated
    const bracketNameInput = page.getByPlaceholder('Enter bracket name')
    await expect(bracketNameInput).toHaveValue(/Michigan.*#\d+/)

    // Click create
    await page.getByRole('button', { name: 'Create Bracket' }).click()

    // Should navigate to bracket edit page
    await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 10000 })

    // Should see bracket editor - check for either Opening Round (24-player) or Round of 16 (both formats)
    // Use .first() because 24-player brackets have both headings visible
    const openingRound = page.getByRole('heading', { name: 'Opening Round' })
    const roundOf16 = page.getByRole('heading', { name: 'Round of 16' })
    await expect(openingRound.or(roundOf16).first()).toBeVisible()
  })
})

test.describe('Dashboard - My Brackets Table', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await verifyLoggedIn(page)
  })

  test('shows empty state when no brackets', async ({ page }) => {
    // Wait for the My Brackets section to load
    await expect(page.getByRole('heading', { name: 'My Brackets' })).toBeVisible({ timeout: 10000 })

    // Note: This test may show brackets if the test user already has some
    // Check for empty state message OR Leaderboard button (appears when brackets exist)
    const emptyMessage = page.getByText(/haven't created any brackets/i)
    const leaderboardButton = page.getByRole('link', { name: 'Leaderboard' }).first()

    // Either empty message or brackets list should be visible
    const hasEmptyState = await emptyMessage.isVisible().catch(() => false)
    const hasBrackets = await leaderboardButton.isVisible().catch(() => false)

    expect(hasEmptyState || hasBrackets).toBe(true)
  })

  test('shows bracket cards for existing brackets', async ({ page }) => {
    // Check if we already have a bracket - if not, create one
    // Cards are now links to the bracket, look for a link with /bracket/ in the href
    const bracketCard = page.locator('a[href^="/bracket/"]').first()
    const hasExistingBracket = await bracketCard.isVisible().catch(() => false)

    if (!hasExistingBracket) {
      // Create a bracket first to ensure we have one
      const stateDropdown = page.locator('select').first()
      await stateDropdown.selectOption({ label: 'Michigan' })

      const tournamentDropdown = page.locator('select').nth(1)
      await tournamentDropdown.selectOption({ index: 1 })

      await page.getByRole('button', { name: 'Create Bracket' }).click()

      // Wait for redirect to edit page
      await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 10000 })

      // Go back to dashboard
      await page.goto('/')
    }

    await expect(page.getByRole('heading', { name: 'My Brackets' })).toBeVisible()

    // Should see clickable bracket card and Leaderboard link
    // Bracket cards link to /bracket/{id}/edit for unlocked or /bracket/{id} for locked
    await expect(page.locator('a[href^="/bracket/"]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Leaderboard' }).first()).toBeVisible()
  })
})
