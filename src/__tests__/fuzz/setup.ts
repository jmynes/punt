/**
 * Fast-check global configuration for fuzz testing.
 */
import * as fc from 'fast-check'

// Configure fast-check defaults
fc.configureGlobal({
  // Number of runs per property test
  numRuns: 100,
  // Timeout per run in milliseconds
  interruptAfterTimeLimit: 5000,
  // Mark interrupted runs as failure
  markInterruptAsFailure: true,
  // Verbose mode for CI debugging
  verbose: process.env.CI ? fc.VerbosityLevel.VeryVerbose : fc.VerbosityLevel.None,
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
