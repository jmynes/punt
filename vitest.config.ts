import path from 'node:path'
import react from '@vitejs/plugin-react'
// Load test environment variables BEFORE any other imports
// This ensures DATABASE_URL points to test.db, not production
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: '.env.test' })

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Global setup runs once before all tests - sets up isolated test database
    globalSetup: ['./src/__tests__/global-setup.ts'],
    // Per-file setup for React Testing Library, mocks, etc.
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
      'src/generated/**',
      '**/*.d.ts',
      // Exclude due to jsdom + @stitches/core CSS parsing incompatibility
      // (sandpack-react bundles @stitches/core which uses CSS custom properties that jsdom can't parse)
      'src/components/tickets/__tests__/ticket-form.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/generated/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/types/**',
        'next.config.ts',
        'vitest.config.ts',
        'prisma.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
