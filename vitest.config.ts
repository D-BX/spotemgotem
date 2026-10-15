import { defineConfig } from 'vitest/config';

// Skin-parser tests are pure (BMP decode, zip, text parsing) and read the real
// .wsz fixtures from disk, so they run in a plain Node environment — no jsdom or
// browser canvas needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
