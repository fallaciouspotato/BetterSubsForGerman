import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
