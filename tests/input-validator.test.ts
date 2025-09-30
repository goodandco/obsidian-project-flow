import { describe, it, expect } from 'vitest';
import { validateTag } from '../src/core/input-validator';

function ok(tag: string) {
  const res = validateTag(tag);
  expect(res.ok).toBe(true);
}
function fail(tag: string) {
  const res = validateTag(tag);
  expect(res.ok).toBe(false);
}

describe('validateTag', () => {
  it('accepts basic alnum and underscores/hyphens', () => {
    ok('proj_1');
    ok('Alpha-01');
  });
  it('accepts forward slashes for nesting', () => {
    ok('team/app');
    ok('A_b-c/d_e-f');
  });
  it('rejects starting with non-alnum', () => {
    fail('/proj');
    fail('-proj');
    fail('_proj');
  });
  it('rejects too short or invalid chars', () => {
    fail('p');
    fail('proj!');
    fail('name with space');
  });
  it('trims whitespace before validating', () => {
    const res = validateTag('  team/app  ');
    expect(res.ok).toBe(true);
  });
  it('rejects empty', () => {
    fail('');
    // also handles whitespace-only
    fail('   ');
  });
});
