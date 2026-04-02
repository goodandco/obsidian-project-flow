import { test, expect } from '../fixtures/electron';

test('plugin API is registered on window', async ({ page }) => {
  const api = await page.evaluate(() => {
    return typeof (window as Record<string, unknown>)['PluginApi']?.['@projectflow/core'];
  });
  expect(api).toBe('object');
});

test('no critical console errors on load', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Brief settle time for async plugin init
  await page.waitForTimeout(2_000);

  const critical = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('net::ERR')
  );
  expect(critical).toEqual([]);
});
