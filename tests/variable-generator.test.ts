import { describe, it, expect } from 'vitest';
import { generateProjectVariables } from '../src/core/variable-generator';

describe('generateProjectVariables', () => {
  it('creates expected variables with parent', () => {
    const now = new Date('2024-03-05T12:00:00Z');
    const vars = generateProjectVariables({
      name: 'MyProj',
      tag: '#proj',
      parent: 'Parent',
      dimension: 'Work',
      category: 'Apps',
    }, now);

    expect(vars.YEAR).toBe('2024');
    expect(vars.DATE).toBe('2024-03-05');
    expect(vars.PROJECT_FULL_NAME).toBe('2024.Parent.MyProj');
    expect(vars.PROJECT_RELATIVE_PATH).toBe('1. Projects/Work/Apps/2024.Parent.MyProj');
    expect(vars.PARENT_TAG).toBe('#proj');
  });

  it('handles no parent', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const vars = generateProjectVariables({
      name: 'Solo',
      tag: '#solo',
      parent: '',
      dimension: 'Personal',
      category: 'Learning',
    }, now);

    expect(vars.PROJECT_FULL_NAME).toBe('2024.Solo');
    expect(vars.PARENT_TAG).toBe('');
  });
});
