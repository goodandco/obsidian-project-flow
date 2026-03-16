import { test as base, Page, chromium, Browser } from '@playwright/test';
import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const CDP_PORT = 9222;
const OBSIDIAN_BIN = '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const OBSIDIAN_CONFIG = path.join(
  os.homedir(),
  'Library/Application Support/obsidian/obsidian.json'
);

// ── Worker-scoped types (one Obsidian instance for the whole suite) ────────
type WorkerFixtures = {
  obsidian: { process: ChildProcess; browser: Browser };
};

// ── Test-scoped types ──────────────────────────────────────────────────────
type TestFixtures = {
  page: Page;
};

// ── obsidian.json helpers ──────────────────────────────────────────────────

function registerVault(vaultPath: string): string {
  const raw = fs.readFileSync(OBSIDIAN_CONFIG, 'utf8');
  const config = JSON.parse(raw);

  for (const id of Object.keys(config.vaults)) {
    delete config.vaults[id].open;
  }

  const existing = Object.entries(config.vaults).find(
    ([, v]) => (v as { path: string }).path === vaultPath
  );

  if (existing) {
    (config.vaults[existing[0]] as Record<string, unknown>).open = true;
    console.log(`[e2e] Vault registered (existing): ${existing[0]}`);
  } else {
    const id = crypto.randomBytes(8).toString('hex');
    config.vaults[id] = { path: vaultPath, ts: Date.now(), open: true };
    console.log(`[e2e] Vault registered (new): ${id}`);
  }

  fs.writeFileSync(OBSIDIAN_CONFIG, JSON.stringify(config));
  return raw;
}

// ── CDP readiness poll ─────────────────────────────────────────────────────

async function waitForCDP(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`CDP port ${port} not available after ${timeoutMs}ms`);
}

// ── Find the workspace page across all CDP contexts ────────────────────────

async function findWorkspacePage(browser: Browser, timeoutMs = 30_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        const found = await p.$('.workspace').catch(() => null);
        if (found) return p;
      }
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error('Workspace (.workspace) not found within 30s');
}

// ── Fixtures ───────────────────────────────────────────────────────────────

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped: one Obsidian process for the entire test suite
  obsidian: [
    async ({}, use) => {
      const vaultPath = process.env.E2E_VAULT_PATH;
      if (!vaultPath) throw new Error('E2E_VAULT_PATH is not set');

      const resolvedVault = path.resolve(vaultPath);
      const obsidianDir = path.join(resolvedVault, '.obsidian');
      if (!fs.existsSync(obsidianDir)) {
        throw new Error(
          `No .obsidian folder at ${obsidianDir}.\nOpen this vault in Obsidian manually first.`
        );
      }

      const originalConfig = registerVault(resolvedVault);

      // Kill any running Obsidian — it's single-instance and would block CDP
      try {
        execSync('pkill -x Obsidian', { stdio: 'ignore' });
        console.log('[e2e] Killed existing Obsidian, waiting for it to exit...');
        await new Promise((r) => setTimeout(r, 2_000));
      } catch {
        // No running instance — that's fine
      }

      const proc = spawn(OBSIDIAN_BIN, [`--remote-debugging-port=${CDP_PORT}`], {
        detached: false,
        stdio: 'ignore',
      });
      proc.on('error', (err) => console.error('[e2e] Spawn error:', err));
      console.log(`[e2e] Obsidian spawned (pid ${proc.pid}), waiting for CDP...`);

      await waitForCDP(CDP_PORT);
      console.log('[e2e] CDP ready');

      const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
      const page = await findWorkspacePage(browser);

      // Handle "trust vault" dialog (Obsidian 1.0+)
      const trustBtn = page.locator('button', { hasText: 'Trust author and enable plugins' });
      if (await trustBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        console.log('[e2e] Trusting vault...');
        await trustBtn.click();
        await page.waitForSelector('.workspace', { timeout: 15_000 });
      }

      console.log('[e2e] Workspace ready');
      await use({ process: proc, browser });

      await browser.close();
      proc.kill();
      fs.writeFileSync(OBSIDIAN_CONFIG, originalConfig);
      console.log('[e2e] Obsidian closed, config restored');
    },
    { scope: 'worker' },
  ],

  // Test-scoped: get the workspace page and reset state before each test
  page: async ({ obsidian }, use) => {
    const page = await findWorkspacePage(obsidian.browser, 5_000);
    // Dismiss any open modal from a previous test
    await page.keyboard.press('Escape').catch(() => {});
    await use(page);
  },
});

/** Open Obsidian settings modal via the internal command API */
export async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).app.commands.executeCommandById('app:open-settings');
  });
  await page.waitForSelector('.modal-container', { timeout: 10_000 });
}

export { expect } from '@playwright/test';
