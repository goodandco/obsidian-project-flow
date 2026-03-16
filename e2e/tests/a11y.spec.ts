// import axe from 'axe-core';
// import { test, expect, openSettings } from '../fixtures/electron';

// // axe-core/playwright doesn't work over CDP — inject axe manually instead
// async function runAxe(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never, tags = ['wcag2a', 'wcag2aa']) {
//   await page.evaluate(axe.source);
//   return page.evaluate((t) =>
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     (window as any).axe.run(document, { runOnly: { type: 'tag', values: t } }),
//     tags
//   ) as Promise<axe.AxeResults>;
// }

// function logAndFilterCritical(results: axe.AxeResults, label: string) {
//   if (results.violations.length > 0) {
//     console.log(`[a11y] ${label} violations:`);
//     results.violations.forEach((v) => {
//       console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
//     });
//   }
//   return results.violations.filter(
//     (v) => v.impact === 'critical' || v.impact === 'serious'
//   );
// }

// test('main workspace has no critical a11y violations', async ({ page }) => {
//   const results = await runAxe(page);
//   const critical = logAndFilterCritical(results, 'workspace');
//   expect(critical).toEqual([]);
// });

// test('settings tab has no critical a11y violations', async ({ page }) => {
//   await openSettings(page);
//   await page.locator('.vertical-tab-nav-item', { hasText: 'ProjectFlow' }).click();

//   const results = await runAxe(page);
//   const critical = logAndFilterCritical(results, 'settings');
//   expect(critical).toEqual([]);
// });
