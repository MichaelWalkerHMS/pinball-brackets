import { test, expect } from '@playwright/test'
import { openMobileMenuIfNeeded, closeMobileMenuIfOpen } from './fixtures/auth'

test.describe('Feedback System', () => {
  test('feedback button appears in header', async ({ page }) => {
    await page.goto('/')

    // On mobile, feedback is inside hamburger menu
    await openMobileMenuIfNeeded(page)

    // Verify Feedback button is visible
    await expect(page.getByRole('button', { name: /feedback/i })).toBeVisible()

    await closeMobileMenuIfOpen(page)
  })

  test('clicking feedback button opens modal', async ({ page }) => {
    await page.goto('/')

    // On mobile, open hamburger menu first
    await openMobileMenuIfNeeded(page)

    // Click the feedback button
    await page.getByRole('button', { name: /feedback/i }).click()

    // Modal should appear with dialog role
    await expect(page.getByRole('dialog')).toBeVisible()

    // Modal should have title "Send Anonymous Feedback"
    await expect(page.getByRole('heading', { name: 'Send Anonymous Feedback' })).toBeVisible()

    // Should have textarea and buttons
    const dialog = page.getByRole('dialog')
    await expect(page.getByLabel('Your Message')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Send Feedback' })).toBeVisible()
  })

  test('modal can be closed with cancel button', async ({ page }) => {
    await page.goto('/')

    // Open modal
    await openMobileMenuIfNeeded(page)
    await page.getByRole('button', { name: /feedback/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should be closed
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('modal can be closed with escape key', async ({ page }) => {
    await page.goto('/')

    // Open modal
    await openMobileMenuIfNeeded(page)
    await page.getByRole('button', { name: /feedback/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Modal should be closed
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('submit button is disabled for empty messages', async ({ page }) => {
    await page.goto('/')

    // Open modal
    await openMobileMenuIfNeeded(page)
    await page.getByRole('button', { name: /feedback/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Leave message empty
    await page.getByLabel('Your Message').fill('')

    // Submit button should be disabled
    await expect(dialog.getByRole('button', { name: 'Send Feedback' })).toBeDisabled()

    // Also test whitespace-only
    await page.getByLabel('Your Message').fill('   ')
    await expect(dialog.getByRole('button', { name: 'Send Feedback' })).toBeDisabled()
  })

  test('can submit valid feedback and see success state', async ({ page }) => {
    await page.goto('/')

    // Open modal
    await openMobileMenuIfNeeded(page)
    await page.getByRole('button', { name: /feedback/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Enter valid feedback message
    const feedbackMessage = `E2E test feedback submission - ${Date.now()}`
    await page.getByLabel('Your Message').fill(feedbackMessage)

    // Submit button should be enabled
    const submitButton = dialog.getByRole('button', { name: 'Send Feedback' })
    await expect(submitButton).toBeEnabled()

    // Submit the feedback
    await submitButton.click()

    // Should see success state
    await expect(page.getByText('Thanks for your feedback!')).toBeVisible({ timeout: 10000 })

    // Modal should auto-close after 2 seconds
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })

  test('character counter updates as user types', async ({ page }) => {
    await page.goto('/')

    // Open modal
    await openMobileMenuIfNeeded(page)
    await page.getByRole('button', { name: /feedback/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Should show 0/1000 initially
    await expect(page.getByText('0/1000 characters')).toBeVisible()

    // Type some text
    await page.getByLabel('Your Message').fill('Hello world')

    // Counter should update
    await expect(page.getByText('11/1000 characters')).toBeVisible()
  })
})
