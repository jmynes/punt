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
  'me/account/delete': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
}

/**
 * Check if a request is rate limited
 * Returns whether the request is allowed and how many attempts remain
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
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
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}
