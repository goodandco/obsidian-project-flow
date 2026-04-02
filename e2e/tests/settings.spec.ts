import { test, expect, openSettings } from '../fixtures/electron';

test.beforeEach(async ({ page }) => {
  await openSettings(page);
});

test('settings modal opens', async ({ page }) => {
  await expect(page.locator('.modal-container')).toBeVisible();
});

test('ProjectFlow settings tab is present and clickable', async ({ page }) => {
  const tab = page.locator('.vertical-tab-nav-item', { hasText: 'ProjectFlow' });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator('.vertical-tab-content-container')).toBeVisible();
});

test('ProjectFlow settings renders key sections', async ({ page }) => {
  await page.locator('.vertical-tab-nav-item', { hasText: 'ProjectFlow' }).click();

  const content = page.locator('.vertical-tab-content-container');
  await expect(content).toBeVisible();

  for (const heading of ['Dimensions', 'AI']) {
    await expect(content.locator(`text=${heading}`).first()).toBeVisible();
  }
});
