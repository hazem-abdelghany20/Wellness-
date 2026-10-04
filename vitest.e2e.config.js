import { defineConfig } from 'vitest/config';

// Real client code (src/lib/*.ts) against a real local Supabase stack — no mocks.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.js'],
    testTimeout: 90000,
    hookTimeout: 90000,
    fileParallelism: false,
    reporters: ['verbose'],
  },
});
