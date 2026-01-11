import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * Match Play Sync Tests
 *
 * These tests verify the Match Play integration functionality:
 * - Tournament form fetch from Match Play (MP-002)
 * - Player import from Match Play (MP-003)
 * - Player refresh with diff detection (MP-004)
 *
 * NOTE: The standard E2E test user (e2e-test@) is not an admin,
 * so these tests verify access control. Actual admin functionality
 * tests are skipped.
 *
 * Additionally, Match Play API calls would need to be mocked for
 * reliable E2E testing in CI.
 */

test.describe('Match Play Sync', () => {
  test.describe('Access Control', () => {
    test('non-admin user cannot access Match Play sync endpoints', async ({ page }) => {
      await login(page)

      // Try to access the Match Play API endpoints directly
      const response = await page.request.get('/api/matchplay/tournament?id=12345')
      expect(response.status()).toBe(403)
    })

    test('unauthenticated user cannot access Match Play sync endpoints', async ({ page }) => {
      const response = await page.request.get('/api/matchplay/tournament?id=12345')
      expect(response.status()).toBe(401)
    })

    test('non-admin user cannot access Match Play players endpoint', async ({ page }) => {
      await login(page)

      const response = await page.request.get('/api/matchplay/players?matchplayId=12345&tournamentId=some-id')
      expect(response.status()).toBe(403)
    })
  })

  // These tests document the expected behavior for admin users.
  // They are skipped since the E2E test user is not an admin and
  // Match Play API would need to be mocked.
  test.describe('Tournament Form Match Play Fetch (MP-002)', () => {
    test.skip('admin can fetch tournament data from Match Play', async ({ page }) => {
      // This test would:
      // 1. Login as admin
      // 2. Navigate to new tournament page
      // 3. Enter a Match Play ID
      // 4. Click "Fetch from MP" button
      // 5. Verify form fields are populated

      await login(page)
      await page.goto('/admin/tournament/new')

      // Enter Match Play ID
      const matchplayInput = page.getByPlaceholder('e.g., 12345')
      await matchplayInput.fill('12345')

      // Click Fetch button
      const fetchButton = page.getByRole('button', { name: 'Fetch from MP' })
      await fetchButton.click()

      // Verify form fields are populated
      const nameInput = page.locator('input#name')
      await expect(nameInput).not.toHaveValue('')
    })

    test.skip('fetch button is disabled without Match Play ID', async ({ page }) => {
      await login(page)
      await page.goto('/admin/tournament/new')

      const fetchButton = page.getByRole('button', { name: 'Fetch from MP' })
      await expect(fetchButton).toBeDisabled()
    })

    test.skip('shows error for invalid Match Play ID', async ({ page }) => {
      await login(page)
      await page.goto('/admin/tournament/new')

      const matchplayInput = page.getByPlaceholder('e.g., 12345')
      await matchplayInput.fill('invalid-id')

      const fetchButton = page.getByRole('button', { name: 'Fetch from MP' })
      await fetchButton.click()

      // Should show error message
      await expect(page.getByText(/not found/i)).toBeVisible()
    })
  })

  test.describe('Player Sync from Match Play (MP-003)', () => {
    test.skip('admin can sync players from Match Play', async ({ page }) => {
      // This test would:
      // 1. Login as admin
      // 2. Navigate to tournament with matchplay_id configured
      // 3. Go to Players tab
      // 4. Click "Sync from Match Play" button
      // 5. Verify players are imported

      await login(page)
      await page.goto('/admin/tournament/test-mp-tournament?tab=players')

      const syncButton = page.getByRole('button', { name: 'Sync from Match Play' })
      await expect(syncButton).toBeVisible()
      await syncButton.click()

      // Wait for sync to complete
      await expect(page.getByText('Syncing...')).toBeVisible()
      await expect(page.getByText('Syncing...')).not.toBeVisible({ timeout: 10000 })

      // Verify players appear in list
      await expect(page.locator('li').first()).toBeVisible()
    })

    test.skip('sync button is hidden when no matchplay_id configured', async ({ page }) => {
      await login(page)
      await page.goto('/admin/tournament/test-no-mp-tournament?tab=players')

      const syncButton = page.getByRole('button', { name: 'Sync from Match Play' })
      await expect(syncButton).not.toBeVisible()
    })
  })

  test.describe('Player Refresh with Diff (MP-004)', () => {
    test.skip('admin sees diff modal when players have changed', async ({ page }) => {
      // This test would:
      // 1. Login as admin
      // 2. Navigate to tournament with existing Match Play players
      // 3. Click "Sync from Match Play" when players have changed
      // 4. Verify diff modal appears
      // 5. Confirm changes

      await login(page)
      await page.goto('/admin/tournament/test-mp-tournament-with-changes?tab=players')

      const syncButton = page.getByRole('button', { name: 'Sync from Match Play' })
      await syncButton.click()

      // Diff modal should appear
      await expect(page.getByText('Confirm Player Changes')).toBeVisible()

      // Should show changes
      await expect(page.getByText(/change.*detected/i)).toBeVisible()

      // Cancel and verify modal closes
      const cancelButton = page.getByRole('button', { name: 'Cancel' })
      await cancelButton.click()
      await expect(page.getByText('Confirm Player Changes')).not.toBeVisible()
    })

    test.skip('admin can apply diff changes', async ({ page }) => {
      await login(page)
      await page.goto('/admin/tournament/test-mp-tournament-with-changes?tab=players')

      const syncButton = page.getByRole('button', { name: 'Sync from Match Play' })
      await syncButton.click()

      // Wait for diff modal
      await expect(page.getByText('Confirm Player Changes')).toBeVisible()

      // Apply changes
      const applyButton = page.getByRole('button', { name: 'Apply Changes' })
      await applyButton.click()

      // Should show loading state
      await expect(page.getByText('Applying...')).toBeVisible()

      // Modal should close after success
      await expect(page.getByText('Confirm Player Changes')).not.toBeVisible({ timeout: 10000 })
    })

    test.skip('diff modal shows warning when brackets exist', async ({ page }) => {
      await login(page)
      await page.goto('/admin/tournament/test-mp-tournament-with-brackets?tab=players')

      const syncButton = page.getByRole('button', { name: 'Sync from Match Play' })
      await syncButton.click()

      // Diff modal should show warning about existing brackets
      await expect(page.getByText(/bracket.*exist/i)).toBeVisible()
      await expect(page.getByText(/seeding changes will affect/i)).toBeVisible()
    })
  })
})
