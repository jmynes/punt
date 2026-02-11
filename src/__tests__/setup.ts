/**
 * Per-file test setup - runs before each test file
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// ============================================================================
// CRITICAL SAFETY CHECK: Prevent tests from using production database
// ============================================================================
// This check runs at import time to fail fast if misconfigured.
// The database-backup tests wipe ALL data - this prevents catastrophic data loss.
const dbUrl = process.env.DATABASE_URL || ''
if (dbUrl && !dbUrl.includes('test.db')) {
  throw new Error(
    `\n` +
      `${'='.repeat(70)}\n` +
      `🚨 CRITICAL: Tests are configured to use production database!\n` +
      `${'='.repeat(70)}\n\n` +
      `   DATABASE_URL: ${dbUrl}\n\n` +
      `   This would WIPE ALL YOUR DATA. Tests have been stopped.\n\n` +
      `   To fix this:\n` +
      `   1. Ensure .env.test exists with DATABASE_URL="file:./test.db"\n` +
      `   2. Run tests with: pnpm test\n\n` +
      `${'='.repeat(70)}\n`,
  )
}

// Mock @stitches/core to avoid CSS parsing issues in jsdom
// This affects @codesandbox/sandpack-react which uses @stitches/core
vi.mock('@stitches/core', () => ({
  createStitches: () => ({
    styled: () => () => null,
    css: () => '',
    globalCss: () => () => {},
    keyframes: () => '',
    theme: {},
    createTheme: () => ({}),
    getCssText: () => '',
    config: {},
  }),
}))

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as unknown as Storage

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.sessionStorage = sessionStorageMock as unknown as Storage
