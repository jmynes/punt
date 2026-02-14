# Testing Guide

This document outlines the testing philosophy, structure, and best practices for PUNT.

## Testing Philosophy

PUNT uses **Vitest** as the testing framework with **React Testing Library** for component testing. Our goal is to achieve comprehensive test coverage (80% minimum) while focusing on:

- **Critical paths**: Store logic, API routes, and utility functions
- **User interactions**: Component behavior and user flows
- **Edge cases**: Error handling, validation, and boundary conditions

## Test Structure

Tests are organized alongside the code they test:

```
src/
├── __tests__/
│   ├── setup.ts              # Global test setup
│   └── utils/
│       ├── test-utils.tsx    # Custom render function
│       └── mocks.ts          # Mock data factories
├── stores/
│   └── __tests__/
│       └── *.test.ts         # Store tests
├── components/
│   └── __tests__/
│       └── *.test.tsx       # Component tests
└── lib/
    └── __tests__/
        └── *.test.ts        # Utility tests
```

## Running Tests

```bash
# Run all tests once
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# Open Vitest UI (interactive test runner)
pnpm test:ui

# Generate coverage report
pnpm test:coverage

# CI mode (no watch, with coverage)
pnpm test:ci
```

## Writing Tests

### Store Tests

Store tests verify state management logic:

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { useBoardStore } from '../board-store'

describe('Board Store', () => {
  beforeEach(() => {
    // Reset store state
    useBoardStore.setState({ columns: [] })
  })

  it('should move ticket between columns', () => {
    // Test implementation
  })
})
```

### Component Tests

Component tests use React Testing Library:

```typescript
import { render, screen } from '@/__tests__/utils/test-utils'
import { Button } from '../button'
import userEvent from '@testing-library/user-event'

describe('Button', () => {
  it('should handle clicks', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })
})
```

### API Route Tests

API route tests mock file system operations:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

describe('Upload API', () => {
  it('should validate file types', async () => {
    // Test implementation
  })
})
```

## Mock Data

Use the mock factories from `src/__tests__/utils/mocks.ts`:

```typescript
import { createMockTicket, createMockColumn } from '@/__tests__/utils/mocks'

const ticket = createMockTicket({ title: 'Test Ticket' })
const column = createMockColumn({ name: 'To Do' })
```

## Debug Logging

PUNT includes a comprehensive debug logging system that is automatically disabled in production builds.

### Usage

```typescript
import { logger } from '@/lib/logger'

// Debug information (detailed)
logger.debug('Processing ticket', { ticketId: 'ticket-1' })

// General information
logger.info('Ticket created', { ticketId: 'ticket-1', title: 'New Ticket' })

// Warnings
logger.warn('Large operation detected', { ticketCount: 1000 })

// Errors
logger.error('Failed to save ticket', error, { ticketId: 'ticket-1' })

// Performance metrics
logger.performance('moveTicket', duration, { ticketId: 'ticket-1' })

// Measure function execution
const result = logger.measure('processTickets', () => {
  // Your code here
})

// Measure async function execution
const result = await logger.measureAsync('fetchTickets', async () => {
  // Your async code here
})
```

### Configuration

Debug logging is controlled by environment variables:

- **Development**: Enabled by default
- **Production**: Automatically disabled (`NODE_ENV === 'production'`)
- **Manual control**: Set `NEXT_PUBLIC_DEBUG=false` to disable, or `NEXT_PUBLIC_DEBUG=true` to enable

### Log Levels

- **debug**: Detailed debugging information
- **info**: General informational messages
- **warn**: Warning messages for potential issues
- **error**: Error messages with stack traces
- **performance**: Performance metrics with timing information

## Coverage Goals

- **Overall**: 80% minimum
- **Critical paths**: 90% minimum (stores, API routes, utilities)
- **Components**: Focus on user interactions and edge cases

## Best Practices

1. **Test behavior, not implementation**: Focus on what the code does, not how it does it
2. **Use descriptive test names**: Test names should clearly describe what is being tested
3. **Keep tests isolated**: Each test should be independent and not rely on other tests
4. **Mock external dependencies**: Use mocks for API calls, file system, etc.
5. **Test edge cases**: Include tests for error conditions, empty states, and boundary values
6. **Use test utilities**: Leverage `test-utils.tsx` and `mocks.ts` for consistency

## Debugging Tests

### Vitest UI

Use `pnpm test:ui` to open the interactive test runner, which provides:
- Real-time test results
- Filtering and searching
- Detailed error messages
- Coverage visualization

### VS Code Integration

Vitest integrates with VS Code. Install the Vitest extension for:
- Inline test results
- Run/debug buttons
- Test discovery

## Database Test Isolation

Tests that interact with SQLite (e.g., `database-backup*.test.ts`) share a single database file and cannot run in parallel. To prevent race conditions, the vitest config uses two projects:

- **`db` project**: Runs database tests with `fileParallelism: false` (sequential execution)
- **`unit` project**: Runs all other tests with full parallelism

Configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'db',
          include: ['src/lib/__tests__/database-backup*.test.ts'],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          exclude: [
            'node_modules', 'dist', '.next', 'coverage', 'src/generated/**',
            'src/lib/__tests__/database-backup*.test.ts',
          ],
        },
      },
    ],
  },
})
```

**Important:** New database test files must be added to the `db` project's `include` pattern and the `unit` project's `exclude` pattern.

## Continuous Integration

Tests run automatically in CI/CD pipelines. The `test:ci` script:
- Runs all tests once (no watch mode)
- Generates coverage reports
- Fails if coverage drops below thresholds

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

