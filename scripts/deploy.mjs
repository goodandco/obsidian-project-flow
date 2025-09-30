#!/usr/bin/env node
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  try {
    const argPath = process.argv[2];
    let vaultPath = argPath;
    if (!vaultPath) {
      vaultPath = await ask('Enter your Obsidian vault path (absolute). Example: /Users/<user>/path/to/MyVault\n> ');
    }
    vaultPath = vaultPath.trim();
    assert(vaultPath, 'Vault path is required.');

    // Build first
    console.log('[deploy] Running production build...');
    execSync('npm run build', { stdio: 'inherit' });

    const pluginDir = join(vaultPath, '.obsidian', 'plugins', 'project-flow');
    if (!existsSync(pluginDir)) {
      console.log(`[deploy] Creating plugin directory: ${pluginDir}`);
      mkdirSync(pluginDir, { recursive: true });
    }

    // Validate artifacts
    assert(existsSync('main.js'), 'main.js not found. Build likely failed.');
    assert(existsSync('manifest.json'), 'manifest.json not found in repo root.');
    assert(existsSync('styles.css'), 'styles.css not found in repo root.');

    // Copy core plugin files
    console.log('[deploy] Copying plugin files to vault...');
    cpSync('main.js', join(pluginDir, 'main.js'));
    cpSync('manifest.json', join(pluginDir, 'manifest.json'));
    cpSync('styles.css', join(pluginDir, 'styles.css'));

    // Copy src/templates into the vault plugin folder if present in repo
    const repoTemplates = join('src', 'templates');
    const vaultTemplates = join(pluginDir, 'src', 'templates');
    try {
      if (existsSync(repoTemplates) && statSync(repoTemplates).isDirectory()) {
        console.log('[deploy] Ensuring templates directory exists in vault...');
        mkdirSync(vaultTemplates, { recursive: true });
        // Node 16 cpSync does not support recursive prior to 16.7; but with fs.cpSync in 16.7+ we can pass recursive
        cpSync(repoTemplates, vaultTemplates, { recursive: true });
      } else {
        console.log('[deploy] No src/templates found in repo; skipping template copy.');
      }
    } catch (e) {
      console.warn('[deploy] Warning while copying templates:', e.message || e);
    }

    console.log(`\n[deploy] SUCCESS. Files copied to: ${pluginDir}`);
    console.log('[deploy] Tip: In Obsidian, toggle the plugin off/on or use "Force reload" to pick up changes.');
  } catch (e) {
    console.error('[deploy] FAILURE:', e.message || e);
    process.exit(1);
  }
}

main();
