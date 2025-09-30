import { describe, it, expect } from 'vitest';
import { processTemplate } from '../src/core/template-processor';

describe('processTemplate', () => {
  it('replaces legacy $_VAR tokens', () => {
    const out = processTemplate('Hello $_NAME', { NAME: 'World' });
    expect(out).toBe('Hello World');
  });
  it('replaces ${VAR} tokens', () => {
    const out = processTemplate('Hello ${NAME}', { NAME: 'World' });
    expect(out).toBe('Hello World');
  });
  it('handles both tokens in one string', () => {
    const out = processTemplate('X ${A} and $_B', { A: '1', B: '2' });
    expect(out).toBe('X 1 and 2');
  });
  it('returns empty string for falsy template', () => {
    // @ts-expect-error testing runtime behavior
    expect(processTemplate(undefined, { A: '1' })).toBe('');
  });
});
