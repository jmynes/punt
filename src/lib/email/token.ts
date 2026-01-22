import { createHash, randomBytes } from 'node:crypto'

/**
 * Token expiry times in milliseconds
 */
export const TOKEN_EXPIRY = {
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
} as const

/**
 * Generate a secure random token
 * @param bytes Number of random bytes (default 32)
 * @returns Base64url-encoded token string
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Hash a token using SHA-256
 * Tokens should always be hashed before storing in the database
 * @param token Plain text token
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Validate a token against a hash
 * @param token Plain text token to validate
 * @param hash Stored hash to compare against
 * @returns true if the token matches the hash
 */
export function validateToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token)
  // Use timing-safe comparison to prevent timing attacks
  if (tokenHash.length !== hash.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < tokenHash.length; i++) {
    result |= tokenHash.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return result === 0
}

/**
 * Check if a token has expired
 * @param expiresAt Expiration date
 * @returns true if the token has expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * Calculate expiration date from now
 * @param expiryMs Expiry time in milliseconds
 * @returns Expiration date
 */
export function getExpirationDate(expiryMs: number): Date {
  return new Date(Date.now() + expiryMs)
}
