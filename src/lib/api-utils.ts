import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

/**
 * Handles common API errors and returns appropriate NextResponse.
 * Use this in catch blocks of API routes to standardize error responses.
 *
 * @param error - The caught error
 * @param action - Description of the action that failed (for logging)
 * @returns NextResponse with appropriate status code
 */
export function handleApiError(error: unknown, action: string): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message.startsWith('Forbidden:') || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
  }
  console.error(`Failed to ${action}:`, error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

/**
 * Creates a validation error response from a failed Zod parse result.
 * Use this when schema.safeParse() returns success: false.
 *
 * Note: We intentionally don't expose detailed validation errors to avoid
 * leaking schema information. Detailed errors are logged server-side only.
 *
 * @param result - The failed Zod parse result (must have success: false and error property)
 * @returns NextResponse with 400 status
 */
export function validationError(result: { success: false; error: ZodError }): NextResponse {
  // Log detailed errors server-side for debugging
  console.error('Validation error:', result.error.flatten())
  // Return generic error to client to avoid leaking schema details
  return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
}

/**
 * Creates a rate limit exceeded response.
 *
 * @param rateLimit - The rate limit result with remaining count and reset time
 * @returns NextResponse with 429 status and rate limit headers
 */
export function rateLimitExceeded(rateLimit: { remaining: number; resetAt: Date }): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
      },
    },
  )
}

/**
 * Creates a not found error response.
 *
 * @param resource - The type of resource that was not found
 * @returns NextResponse with 404 status
 */
export function notFoundError(resource: string): NextResponse {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
}

/**
 * Creates a bad request error response.
 *
 * @param message - The error message
 * @returns NextResponse with 400 status
 */
export function badRequestError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Creates a password validation error response.
 *
 * @param errors - Array of password validation error messages
 * @returns NextResponse with 400 status
 */
export function passwordValidationError(errors: string[]): NextResponse {
  return NextResponse.json(
    { error: 'Password does not meet requirements', details: errors },
    { status: 400 },
  )
}
