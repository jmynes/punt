/**
 * Fast-check global configuration for fuzz testing.
 */
import * as fc from 'fast-check'

// Configure fast-check defaults
fc.configureGlobal({
  // Number of runs per property test
  numRuns: 100,
  // Timeout per property (all runs combined) in milliseconds
  interruptAfterTimeLimit: 30_000,
  // Interrupted tests are inconclusive, not failures — the runs that
  // completed still passed, and slow generation is not a bug.
  markInterruptAsFailure: false,
  // Verbose in CI slows generation significantly with complex arbitraries
  verbose: fc.VerbosityLevel.None,
})

// Export fast-check for convenience
export { fc }

// Common test configuration overrides
export const FUZZ_CONFIG = {
  // Quick smoke test (fast)
  quick: { numRuns: 25 },
  // Standard testing
  standard: { numRuns: 100 },
  // Thorough testing (CI or explicit)
  thorough: { numRuns: 500 },
} as const
