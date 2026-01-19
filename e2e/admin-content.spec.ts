import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/auth'

test.describe('Admin CMS', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test.describe('Content Dashboard', () => {
    test('displays content management dashboard', async ({ page }) => {
      await page.goto('/admin/content')

      // Verify page header
      await expect(page.getByRole('heading', { name: 'Content Management' })).toBeVisible()
      await expect(page.getByText('Edit static pages and FAQ content')).toBeVisible()

      // Verify Pages section
      await expect(page.getByRole('heading', { name: 'Pages' })).toBeVisible()
      // Use more specific selectors to avoid matching footer links
      const pagesSection = page.locator('h2:has-text("Pages")').locator('..').locator('..')
      await expect(pagesSection.getByRole('link', { name: /About/ })).toBeVisible()
      await expect(pagesSection.getByRole('link', { name: /Privacy/ })).toBeVisible()
      await expect(pagesSection.getByRole('link', { name: /Changelog/ })).toBeVisible()

      // Verify FAQ section
      await expect(page.getByRole('heading', { name: 'FAQ' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Frequently Asked Questions/ })).toBeVisible()
    })

    test('navigates to page editor from dashboard', async ({ page }) => {
      await page.goto('/admin/content')

      // Click on About page
      await page.getByRole('link', { name: /About/ }).click()

      // Should be on the About editor
      await expect(page).toHaveURL('/admin/content/about')
      await expect(page.getByRole('link', { name: /Back to Content/ })).toBeVisible()
    })

    test('navigates to FAQ editor from dashboard', async ({ page }) => {
      await page.goto('/admin/content')

      // Click on FAQ
      await page.getByRole('link', { name: /Frequently Asked Questions/ }).click()

      // Should be on the FAQ editor
      await expect(page).toHaveURL('/admin/content/faq')
    })
  })

  test.describe('Page Content Editor', () => {
    test('displays content editor with title and content fields', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Verify editor elements
      await expect(page.getByRole('link', { name: /Back to Content/ })).toBeVisible()
      await expect(page.getByLabel('Page Title')).toBeVisible()
      await expect(page.getByLabel(/Content/)).toBeVisible()

      // Verify action buttons
      await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
    })

    test('save button is disabled when no changes made', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Save button should be disabled initially
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    })

    test('save button becomes enabled when content is modified', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Wait for the content to load
      const contentArea = page.getByLabel(/Content/)
      await expect(contentArea).toBeVisible()
      await contentArea.waitFor({ state: 'visible' })

      // Click to focus, then type additional content (more reliable for change detection)
      await contentArea.click()
      await page.keyboard.press('End')
      await page.keyboard.type('\n\nTest modification')

      // Save button should now be enabled
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    })

    test('can toggle between edit and preview modes', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Initially in edit mode - textarea should be visible
      await expect(page.getByLabel(/Content/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()

      // Click Preview button
      await page.getByRole('button', { name: 'Preview' }).click()

      // Should now show Edit button and preview content
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
      // The textarea should be hidden in preview mode
      await expect(page.getByLabel(/Content/)).not.toBeVisible()

      // Click Edit to go back
      await page.getByRole('button', { name: 'Edit' }).click()

      // Should be back to edit mode
      await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()
      await expect(page.getByLabel(/Content/)).toBeVisible()
    })

    test('saves content changes successfully', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Wait for the content to load
      const contentArea = page.getByLabel(/Content/)
      await expect(contentArea).toBeVisible()
      const currentContent = await contentArea.inputValue()

      // Add a unique marker using keyboard (more reliable for change detection)
      const testMarker = `\n\n<!-- E2E Test: ${Date.now()} -->`
      await contentArea.click()
      await page.keyboard.press('End')
      await page.keyboard.type(testMarker)

      // Save
      await page.getByRole('button', { name: 'Save Changes' }).click()

      // Should show success message
      await expect(page.getByText('Changes saved successfully!')).toBeVisible()

      // Revert the change to not pollute the database
      // Use select all + type to replace all content
      await contentArea.click()
      await page.keyboard.press('Meta+a')
      await page.keyboard.press('Control+a')
      await page.keyboard.type(currentContent)
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByText('Changes saved successfully!')).toBeVisible()
    })

    test('shows last saved timestamp', async ({ page }) => {
      await page.goto('/admin/content/about')

      // Should show last saved info
      await expect(page.getByText(/Last saved:/)).toBeVisible()
    })
  })

  test.describe('FAQ Editor', () => {
    test('displays FAQ editor with existing items', async ({ page }) => {
      await page.goto('/admin/content/faq')

      // Verify page header
      await expect(page.getByRole('heading', { name: 'Edit FAQ' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Back to Content/ })).toBeVisible()

      // Should have Add New FAQ button
      await expect(page.getByRole('button', { name: /Add New FAQ/i })).toBeVisible()
    })

    test('can open add FAQ item form', async ({ page }) => {
      await page.goto('/admin/content/faq')

      // Click Add New FAQ
      await page.getByRole('button', { name: /Add New FAQ/i }).click()

      // Should show form with heading
      await expect(page.getByRole('heading', { name: 'Add New FAQ' })).toBeVisible()

      // Should have Cancel button
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add FAQ' })).toBeVisible()
    })

    test('can cancel adding FAQ item', async ({ page }) => {
      await page.goto('/admin/content/faq')

      // Open the form
      await page.getByRole('button', { name: /Add New FAQ/i }).click()
      await expect(page.getByRole('heading', { name: 'Add New FAQ' })).toBeVisible()

      // Cancel
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Form should be hidden
      await expect(page.getByRole('heading', { name: 'Add New FAQ' })).not.toBeVisible()
    })

    test('adds and deletes a FAQ item', async ({ page }) => {
      await page.goto('/admin/content/faq')

      // Open the form
      await page.getByRole('button', { name: /Add New FAQ/i }).click()

      // Fill in the form using placeholder text
      const testQuestion = `E2E Test Question ${Date.now()}`
      const testAnswer = 'This is a test answer for E2E testing.'

      await page.getByPlaceholder('Enter the question...').fill(testQuestion)
      await page.getByPlaceholder('Enter the answer...').fill(testAnswer)

      // Save
      await page.getByRole('button', { name: 'Add FAQ' }).click()

      // Should see the new FAQ item as a button (the expandable question)
      const questionButton = page.getByRole('button', { name: testQuestion })
      await expect(questionButton).toBeVisible({ timeout: 10000 })

      // Now delete it to clean up
      // The FAQ item structure has the question button and a sibling container with Edit/Delete
      // Find the parent container that holds both
      const faqItemContainer = questionButton.locator('..')

      // Handle the confirmation dialog before clicking
      page.on('dialog', dialog => dialog.accept())

      // Click the delete button within the same FAQ item
      await faqItemContainer.getByRole('button', { name: /delete/i }).click()

      // Item should be removed
      await expect(page.getByRole('button', { name: testQuestion })).not.toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Access Control', () => {
    test('content dashboard requires admin authentication', async ({ page, context }) => {
      // Clear all cookies and storage to ensure truly logged out state
      await context.clearCookies()
      await page.goto('/')

      // Verify we're not logged in (login link should be visible)
      await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible({ timeout: 5000 })

      // Try to access content dashboard without being logged in
      // The app may redirect immediately, which can interrupt navigation - that's expected
      try {
        await page.goto('/admin/content')
      } catch {
        // Navigation interruption is OK - the redirect is the expected behavior
      }

      // Should be redirected away from admin (to login page or home)
      // Give time for redirect to settle
      await page.waitForTimeout(1000)
      await expect(page).not.toHaveURL(/\/admin\/content/)
    })
  })
})
