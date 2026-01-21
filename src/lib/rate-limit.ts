import { db } from '@/lib/db'

interface RateLimitConfig {
  limit: number
  windowMs: number
}

// Default rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'auth/login': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 attempts per 15 min
  'auth/register': { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 attempts per hour
  'admin/users': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  'me/password': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'me/email': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  'me/account/delete': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
}

/**
 * Check if a request is rate limited
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

  // If no record or record is outside window, create/reset
  if (!current || current.windowStart < windowStart) {
    await db.rateLimit.upsert({
      where: { identifier_endpoint: { identifier, endpoint } },
      create: { identifier, endpoint, count: 1, windowStart: new Date() },
      update: { count: 1, windowStart: new Date() },
    })
    return {
      allowed: true,
      remaining: config.limit - 1,
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

  // Increment counter
  await db.rateLimit.update({
    where: { identifier_endpoint: { identifier, endpoint } },
    data: { count: { increment: 1 } },
  })

  return {
    allowed: true,
    remaining: config.limit - current.count - 1,
    resetAt: new Date(current.windowStart.getTime() + config.windowMs),
  }
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
