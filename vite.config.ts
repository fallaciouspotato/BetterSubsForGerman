/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    preact(),
    crx({
      manifest,
      contentScripts: {
        preambleCode: false,
        standaloneFiles: ['src/content/bridge.ts', 'src/content/main-world.ts'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      format: {
        ascii_only: true, // Escapes all non-ASCII characters to \uXXXX to satisfy Chrome's strict content script validator
      },
    },
  },
});
