import { Page, expect, test } from '@playwright/test'

/**
 * Get test user credentials for the current worker.
 * Each worker gets its own user to avoid session conflicts.
 * Uses E2E_TEST_EMAIL_0, E2E_TEST_EMAIL_1, etc.
 */
function getTestUserCredentials(): { email: string; password: string } {
  const workerIndex = test.info().parallelIndex

  const email = process.env[`E2E_TEST_EMAIL_${workerIndex}`]
  const password = process.env[`E2E_TEST_PASSWORD_${workerIndex}`]

  if (!email || !password) {
    throw new Error(
      `Missing credentials for worker ${workerIndex}. ` +
      `Ensure E2E_TEST_EMAIL_${workerIndex} and E2E_TEST_PASSWORD_${workerIndex} are set in .env.test`
    )
  }

  return { email, password }
}

/**
 * Save the current bracket and wait for confirmation.
 * More reliable than just checking for "Saved!" text.
 */
export async function saveBracket(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save' })

  // Wait for button to be enabled (not in "Saving..." state)
  await expect(saveButton).toBeEnabled({ timeout: 5000 })

  // Click save
  await saveButton.click()

  // Wait for either:
  // 1. "Saved!" message to appear
  // 2. Button text to change to "Saving..." then back to "Save"
  // Use a combination approach for reliability
  await expect(
    page.getByText(/saved!/i).or(page.getByText('Saved!'))
  ).toBeVisible({ timeout: 15000 })
}

/**
 * Check if we're on a mobile viewport by looking for the hamburger menu button.
 * If visible, click it to open the mobile menu.
 * Returns true if menu was opened, false if not on mobile.
 */
export async function openMobileMenuIfNeeded(page: Page): Promise<boolean> {
  const menuButton = page.getByRole('button', { name: 'Menu' })
  const isMenuButtonVisible = await menuButton.isVisible().catch(() => false)

  if (isMenuButtonVisible) {
    await menuButton.click()
    // Wait for menu to open by checking if it has role="menu"
    await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 3000 })
    return true
  }
  return false
}

/**
 * Close the mobile menu if it's open.
 */
export async function closeMobileMenuIfOpen(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Menu' })
  const isMenuButtonVisible = await menuButton.isVisible().catch(() => false)
  const isMenuOpen = await page.locator('[role="menu"]').isVisible().catch(() => false)

  if (isMenuButtonVisible && isMenuOpen) {
    await menuButton.click()
    // Wait for menu to close
    await expect(page.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 })
  }
}

/**
 * Verify that user is logged in. Works on both desktop and mobile viewports.
 * Opens the mobile menu if needed to check for Log Out button.
 */
export async function verifyLoggedIn(page: Page): Promise<void> {
  const mobileMenuOpened = await openMobileMenuIfNeeded(page)

  // Check for Log Out button (confirms logged-in state)
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible({ timeout: 10000 })

  // Close mobile menu if we opened it
  if (mobileMenuOpened) {
    await closeMobileMenuIfOpen(page)
  }
}

/**
 * Login as the E2E test user for this worker
 */
export async function login(page: Page): Promise<void> {
  const { email, password } = getTestUserCredentials()

  await page.goto('/login')

  // Fill in login form
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)

  // Submit the form
  await page.getByRole('button', { name: /log in/i }).click()

  // Wait for successful login - should redirect to homepage
  await expect(page).toHaveURL('/', { timeout: 10000 })
}

/**
 * Logout the current user. Handles mobile hamburger menu automatically.
 */
export async function logout(page: Page): Promise<void> {
  // Open mobile menu if needed
  await openMobileMenuIfNeeded(page)

  // Find and click the logout button
  await page.getByRole('button', { name: /log out/i }).click()

  // Wait for redirect to login or homepage
  await expect(page).toHaveURL(/\/(login)?$/, { timeout: 10000 })
}

/**
 * Check if user is logged in by looking for auth-dependent UI elements.
 * Handles mobile hamburger menu automatically.
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Open mobile menu if needed
    const mobileMenuOpened = await openMobileMenuIfNeeded(page)

    // Look for the Log Out button as indicator of logged-in state
    const logOutButton = page.getByRole('button', { name: /log out/i })
    await logOutButton.waitFor({ timeout: 2000 })

    // Close mobile menu if we opened it
    if (mobileMenuOpened) {
      await closeMobileMenuIfOpen(page)
    }

    return true
  } catch {
    return false
  }
}

/**
 * Navigate to bracket editor for a specific tournament.
 * Uses the dashboard: either navigates to edit URL of existing bracket, or creates new via wizard.
 */
export async function navigateToBracketEditor(
  page: Page,
  options: { state?: string; tournamentName?: string } = {}
): Promise<void> {
  const { state = 'Michigan', tournamentName } = options

  // Ensure we're on the dashboard (homepage) first
  const currentUrl = page.url()
  if (!currentUrl.endsWith('/') && !currentUrl.includes('localhost:3000/$')) {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  }

  // Verify we're still logged in (session might have expired)
  const myBracketsHeading = page.getByRole('heading', { name: 'My Brackets' })
  const isOnDashboard = await myBracketsHeading.isVisible({ timeout: 5000 }).catch(() => false)

  if (!isOnDashboard) {
    // Session might have expired - check if we're redirected to login
    if (page.url().includes('/login')) {
      throw new Error('Session expired - redirected to login page. Re-login required.')
    }
  }

  // Check if we have an existing bracket card (link to /bracket/{id})
  // The card links are styled as full cards now, not separate Edit buttons
  const bracketCard = page.locator('a[href^="/bracket/"]').first()
  const hasExistingBracket = await bracketCard.isVisible().catch(() => false)

  if (hasExistingBracket) {
    // Get the bracket URL and navigate directly to edit
    const href = await bracketCard.getAttribute('href')
    if (href) {
      // Navigate to the edit page
      // If bracket is not locked, href already ends with /edit
      // If bracket is locked, href is just /bracket/{id} and we need to append /edit
      const editUrl = href.endsWith('/edit') ? href : href + '/edit'
      await page.goto(editUrl)
    }
  } else {
    // Use the Create Bracket wizard
    const stateDropdown = page.locator('select').first()
    await stateDropdown.selectOption({ label: state })

    // Wait for tournament dropdown to populate
    await page.waitForTimeout(500)

    const tournamentDropdown = page.locator('select').nth(1)
    if (tournamentName) {
      await tournamentDropdown.selectOption({ label: tournamentName })
    } else {
      // Select first available tournament
      await tournamentDropdown.selectOption({ index: 1 })
    }

    await page.getByRole('button', { name: 'Create Bracket' }).click()
  }

  // Wait for bracket editor to load - if redirected to login, session expired
  const urlResult = await expect(page).toHaveURL(/\/bracket\/.*\/edit/, { timeout: 15000 }).catch(() => null)
  if (urlResult === null && page.url().includes('/login')) {
    throw new Error('Session expired during bracket creation - redirected to login page.')
  }

  // Wait for either Opening Round (24-player) or Round of 16 (16-player) heading
  // Use .first() because 24-player brackets have both headings visible
  await expect(
    page.getByRole('heading', { name: 'Opening Round' }).or(
      page.getByRole('heading', { name: 'Round of 16' })
    ).first()
  ).toBeVisible()
}
