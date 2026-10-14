import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1200, height: 800 },
    reducedMotion: 'reduce',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI, timeout: 30_000 },
});
