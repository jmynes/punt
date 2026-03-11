import { db } from '@/lib/db'

interface RateLimitConfig {
  limit: number
  windowMs: number
}

// Default rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'auth/login': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15 min
  'auth/register': { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 attempts per hour
  'auth/forgot-password': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour per email
  'auth/reset-password': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'auth/send-verification': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour per user
  'auth/verify-email': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min per IP
  'admin/users': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  'admin/email-test': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 test emails per 15 min
  'auth/2fa': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 TOTP attempts per 15 min
  'me/2fa': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 2FA management attempts per 15 min
  'me/password': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'me/email': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'me/account/delete': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  'projects/create': { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 projects per hour
}

/**
 * Check if a request is rate limited (does NOT increment counter)
 * Returns whether the request is allowed and how many attempts remain
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[endpoint] || { limit: 100, windowMs: 60 * 1000 }
  const windowStart = new Date(Date.now() - config.windowMs)

  // Clean up old rate limit entries (older than the window)
  await db.rateLimit.deleteMany({
    where: { windowStart: { lt: windowStart } },
  })

  // Find current rate limit record
  const current = await db.rateLimit.findUnique({
    where: { identifier_endpoint: { identifier, endpoint } },
  })

  // If no record or record is outside window, not rate limited
  if (!current || current.windowStart < windowStart) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowMs),
    }
  }

  // Check if limit exceeded
  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(current.windowStart.getTime() + config.windowMs),
    }
  }

  return {
    allowed: true,
    remaining: config.limit - current.count,
    resetAt: new Date(current.windowStart.getTime() + config.windowMs),
  }
}

/**
 * Record a failed attempt for rate limiting
 * Call this ONLY on failed attempts (wrong password, invalid 2FA, etc.)
 */
export async function recordFailedAttempt(identifier: string, endpoint: string): Promise<void> {
  const config = RATE_LIMITS[endpoint] || { limit: 100, windowMs: 60 * 1000 }
  const windowStart = new Date(Date.now() - config.windowMs)

  // Find current rate limit record
  const current = await db.rateLimit.findUnique({
    where: { identifier_endpoint: { identifier, endpoint } },
  })

  // If no record or record is outside window, create new
  if (!current || current.windowStart < windowStart) {
    await db.rateLimit.upsert({
      where: { identifier_endpoint: { identifier, endpoint } },
      create: { identifier, endpoint, count: 1, windowStart: new Date() },
      update: { count: 1, windowStart: new Date() },
    })
    return
  }

  // Increment counter
  await db.rateLimit.update({
    where: { identifier_endpoint: { identifier, endpoint } },
    data: { count: { increment: 1 } },
  })
}

/**
 * Clear rate limit counter on successful authentication
 * Call this after successful login to reset the failed attempt counter
 */
export async function clearRateLimit(identifier: string, endpoint: string): Promise<void> {
  await db.rateLimit.deleteMany({
    where: { identifier, endpoint },
  })
}

/**
 * Simple string hash for fingerprinting
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32-bit integer
  }
  return hash.toString(16)
}

/**
 * Get client IP from request headers
 * Only trusts proxy headers if TRUST_PROXY environment variable is set to 'true'
 */
export function getClientIp(request: Request): string {
  // Only trust proxy headers if explicitly configured
  const trustProxy = process.env.TRUST_PROXY === 'true'

  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    const realIp = request.headers.get('x-real-ip')
    if (realIp) {
      return realIp
    }
  }

  // Fallback: use combination of multiple headers for fingerprint
  // This is harder to spoof than just user-agent + accept-language
  const userAgent = request.headers.get('user-agent') || ''
  const acceptLang = request.headers.get('accept-language') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  const connection = request.headers.get('connection') || ''
  const secFetchDest = request.headers.get('sec-fetch-dest') || ''
  const secFetchMode = request.headers.get('sec-fetch-mode') || ''
  const secFetchSite = request.headers.get('sec-fetch-site') || ''

  // Combine multiple fingerprint signals
  const fingerprint = [
    userAgent,
    acceptLang,
    acceptEncoding,
    connection,
    secFetchDest,
    secFetchMode,
    secFetchSite,
  ].join('|')

  return `fingerprint:${hashString(fingerprint)}`
}
