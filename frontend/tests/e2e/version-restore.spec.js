/**
 * @file E2E tests for version restore functionality
 * @tags @auth @version-restore
 *
 * Tests Enhanced Pattern B implementation:
 * 1. Concurrent editor detection
 * 2. Origin tagging for audit trail
 * 3. Read-only lock during restore
 * 4. Owner-only permission
 */

import { test, expect } from '@playwright/test'

test.describe('Version Restore Tests @auth @version-restore', () => {
  let fileId
  let versionId

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL)
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD)
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/workspace')

    // Create a test file
    await page.click('[data-testid="new-file-button"]')
    await page.waitForSelector('[data-testid="file-title-input"]')
    await page.fill('[data-testid="file-title-input"]', 'Version Restore Test')

    // Add initial content
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.waitForSelector('.cm-container')
    await page.fill('.cm-content', '# Original Content\n\nThis is the first version.')

    // Save and get file ID from URL
    await page.waitForTimeout(1000) // Wait for auto-save
    const url = page.url()
    fileId = url.match(/\/file\/(\d+)/)?.[1]

    // Create a named version
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="save-version-button"]')
    await page.click('[data-testid="save-version-button"]')
    await page.waitForSelector('[data-testid="version-name-input"]')
    await page.fill('[data-testid="version-name-input"]', 'First Draft')
    await page.click('[data-testid="confirm-save-version"]')
    await page.waitForSelector('[data-testid="version-item"]')

    // Get version ID from the version item
    const versionItem = page.locator('[data-testid="version-item"]').first()
    versionId = await versionItem.getAttribute('data-version-id')

    // Modify content after creating version
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.waitForSelector('.cm-container')
    await page.fill('.cm-content', '# Modified Content\n\nThis is the second version with changes.')
    await page.waitForTimeout(1000) // Wait for auto-save
  })

  test('owner can restore version', async ({ page }) => {
    // Open versions drawer
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')

    // Click on version to preview
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="version-preview"]')

    // Verify current content in preview shows difference
    const currentContent = await page.locator('[data-testid="current-content"]').textContent()
    expect(currentContent).toContain('Modified Content')

    // Click restore button
    await page.click('[data-testid="restore-version-button"]')

    // Should show confirmation dialog
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    expect(await page.locator('[data-testid="restore-confirm-dialog"]').textContent())
      .toContain('restore')

    // Confirm restore
    await page.click('[data-testid="confirm-restore-button"]')

    // Wait for restore to complete
    await page.waitForSelector('[data-testid="restore-success-toast"]', { timeout: 5000 })

    // Verify content was restored
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.waitForSelector('.cm-container')
    const restoredContent = await page.locator('.cm-content').textContent()
    expect(restoredContent).toContain('Original Content')
    expect(restoredContent).toContain('first version')
    expect(restoredContent).not.toContain('Modified Content')
  })

  test('non-owner cannot restore version', async ({ page, context }) => {
    // TODO: This test requires creating a second user and sharing file
    // For now, skip - will implement after permission system is hooked up
    test.skip()
  })

  test('concurrent editor detection shows warning', async ({ page, context }) => {
    // Open file in second tab (simulating concurrent editor)
    const page2 = await context.newPage()
    await page2.goto(`/file/${fileId}`)
    await page2.waitForSelector('[data-testid="workspace-sidebar"]')

    // Start editing in second tab
    await page2.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page2.waitForSelector('.cm-container')
    await page2.fill('.cm-content', '# Concurrent Edit\n\nUser 2 is typing...')

    // In first tab, try to restore
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="restore-version-button"]')
    await page.click('[data-testid="restore-version-button"]')

    // Should show concurrent editor warning
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    const dialogText = await page.locator('[data-testid="restore-confirm-dialog"]').textContent()
    expect(dialogText).toContain('other user')
    expect(dialogText).toContain('editing')

    // Cancel restore
    await page.click('[data-testid="cancel-restore-button"]')

    // Verify content was not restored
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.waitForSelector('.cm-container')
    const content = await page.locator('.cm-content').textContent()
    expect(content).not.toContain('Original Content')

    await page2.close()
  })

  test('editor is read-only during restore', async ({ page }) => {
    // Open versions and start restore
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="restore-version-button"]')

    // Open source editor
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.waitForSelector('.cm-container')

    // Start restore
    await page.click('[data-testid="restore-version-button"]')
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    await page.click('[data-testid="confirm-restore-button"]')

    // During restore, editor should be read-only
    // Check for read-only attribute or class
    const isReadOnly = await page.locator('.cm-editor').getAttribute('contenteditable')
    expect(isReadOnly).toBe('false')

    // Wait for restore to complete
    await page.waitForSelector('[data-testid="restore-success-toast"]', { timeout: 5000 })

    // After restore, editor should be editable again
    const isEditableAfter = await page.locator('.cm-editor').getAttribute('contenteditable')
    expect(isEditableAfter).toBe('true')
  })

  test('all connected clients see restored content', async ({ page, context }) => {
    // Open file in second tab
    const page2 = await context.newPage()
    await page2.goto(`/file/${fileId}`)
    await page2.waitForSelector('[data-testid="workspace-sidebar"]')
    await page2.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page2.waitForSelector('.cm-container')

    // Verify second tab shows modified content
    let content2 = await page2.locator('.cm-content').textContent()
    expect(content2).toContain('Modified Content')

    // In first tab, restore version
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="restore-version-button"]')
    await page.click('[data-testid="restore-version-button"]')
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    await page.click('[data-testid="confirm-restore-button"]')
    await page.waitForSelector('[data-testid="restore-success-toast"]', { timeout: 5000 })

    // Wait for Y.js to sync to second tab
    await page2.waitForTimeout(1000)

    // Verify second tab now shows restored content
    content2 = await page2.locator('.cm-content').textContent()
    expect(content2).toContain('Original Content')
    expect(content2).not.toContain('Modified Content')

    await page2.close()
  })

  test('restore operation is logged for audit trail', async ({ page }) => {
    // This test verifies backend audit logging
    // We'll check browser console for origin tagging confirmation
    const consoleLogs = []
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text())
      }
    })

    // Restore version
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="restore-version-button"]')
    await page.click('[data-testid="restore-version-button"]')
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    await page.click('[data-testid="confirm-restore-button"]')
    await page.waitForSelector('[data-testid="restore-success-toast"]', { timeout: 5000 })

    // Check console logs for restore operation
    const restoreLog = consoleLogs.find(log =>
      log.includes('restore-version') || log.includes('Version restored')
    )
    expect(restoreLog).toBeTruthy()
  })

  test('cannot restore while another restore is in progress', async ({ page }) => {
    // Open versions
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button')
    await page.waitForSelector('[data-testid="version-item"]')
    await page.click(`[data-testid="version-item"][data-version-id="${versionId}"]`)
    await page.waitForSelector('[data-testid="restore-version-button"]')

    // Start first restore
    await page.click('[data-testid="restore-version-button"]')
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]')
    await page.click('[data-testid="confirm-restore-button"]')

    // Immediately try to start second restore (before first completes)
    // Button should be disabled
    const isDisabled = await page.locator('[data-testid="restore-version-button"]').isDisabled()
    expect(isDisabled).toBe(true)

    // Wait for first restore to complete
    await page.waitForSelector('[data-testid="restore-success-toast"]', { timeout: 5000 })

    // Now button should be enabled again
    const isEnabledAfter = await page.locator('[data-testid="restore-version-button"]').isDisabled()
    expect(isEnabledAfter).toBe(false)
  })
})
