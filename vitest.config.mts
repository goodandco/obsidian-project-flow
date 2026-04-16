import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      obsidian: new URL('./tests/__mocks__/obsidian.ts', import.meta.url).pathname,
    },
  },
});
