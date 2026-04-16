#!/usr/bin/env node
/**
 * Usage: node scripts/bump-version.mjs [patch|minor|major]
 *
 * Bumps the version in manifest.json and package.json, commits, and creates a git tag.
 * Uses manifest.json as the source of truth.
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const bump = process.argv[2];
if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/bump-version.mjs [patch|minor|major]");
  process.exit(1);
}

// Read current version from manifest.json (source of truth)
const manifestPath = resolve(root, "manifest.json");
const packagePath = resolve(root, "package.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

const [major, minor, patch] = manifest.version.split(".").map(Number);

let nextVersion;
if (bump === "major") nextVersion = `${major + 1}.0.0`;
else if (bump === "minor") nextVersion = `${major}.${minor + 1}.0`;
else nextVersion = `${major}.${minor}.${patch + 1}`;

console.log(`${manifest.version} → ${nextVersion}`);

manifest.version = nextVersion;
pkg.version = nextVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

execSync(`git add manifest.json package.json`, { cwd: root, stdio: "inherit" });
execSync(`git commit -m "chore: bump version to ${nextVersion}"`, { cwd: root, stdio: "inherit" });
execSync(`git tag ${nextVersion}`, { cwd: root, stdio: "inherit" });

console.log(`\nTagged ${nextVersion}. Push with:\n  git push && git push origin ${nextVersion}`);
