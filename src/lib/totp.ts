import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { generateURI, generateSecret as otplibGenerateSecret, verifySync } from 'otplib'
import QRCode from 'qrcode'
import { hashPassword, verifyPassword } from '@/lib/password'

// Derive an encryption key from a given secret using HKDF for proper domain separation
function getEncryptionKeyFromSecret(authSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', authSecret, 'punt-totp-secret-encryption', '', 32))
}

// Encryption key derived from AUTH_SECRET using HKDF for proper domain separation
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required for TOTP encryption')
  }
  return getEncryptionKeyFromSecret(secret)
}

/**
 * Encrypt a TOTP secret for storage.
 * Uses AES-256-GCM for authenticated encryption.
 */
export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Store as iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a stored TOTP secret.
 */
export function decryptTotpSecret(encryptedSecret: string): string {
  const key = getEncryptionKey()
  const parts = encryptedSecret.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted TOTP secret format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Re-encrypt a TOTP secret from an old AUTH_SECRET to the current server's AUTH_SECRET.
 * Used during database import to make 2FA portable across servers.
 */
export function reencryptTotpSecret(encryptedSecret: string, oldAuthSecret: string): string {
  const oldKey = getEncryptionKeyFromSecret(oldAuthSecret)
  const parts = encryptedSecret.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted TOTP secret format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  // Decrypt with old key
  const decipher = createDecipheriv('aes-256-gcm', oldKey, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  // Re-encrypt with current server's key
  return encryptTotpSecret(decrypted)
}

/**
 * Generate a new TOTP secret.
 */
export function generateTotpSecret(): string {
  return otplibGenerateSecret()
}

/**
 * Generate a TOTP key URI for QR code scanning.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateTotpKeyUri(secret: string, username: string, issuer: string): string {
  return generateURI({ secret, issuer, label: `${issuer}:${username}` })
}

/**
 * Generate a QR code data URL from a key URI.
 */
export async function generateQrCodeDataUrl(keyUri: string): Promise<string> {
  return QRCode.toDataURL(keyUri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

/**
 * Verify a TOTP token against a secret.
 * Uses epochTolerance of 30 seconds (allows one time window before/after).
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  const result = verifySync({ token, secret, epochTolerance: 30 })
  return result.valid
}

/**
 * Generate recovery codes.
 * Returns an array of 8 random recovery codes.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Generate 10-character alphanumeric codes in format XXXXX-XXXXX
    const part1 = randomBytes(3).toString('hex').slice(0, 5).toUpperCase()
    const part2 = randomBytes(3).toString('hex').slice(0, 5).toUpperCase()
    codes.push(`${part1}-${part2}`)
  }
  return codes
}

/**
 * Hash recovery codes for storage using bcrypt.
 * Returns array of hashed codes (stored as native JSON in PostgreSQL).
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => hashPassword(code)))
}

/**
 * Coerce a recovery codes value to a string array.
 * Handles both native JSON arrays (PostgreSQL) and legacy JSON strings.
 */
function coerceRecoveryCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through to fallback
    }
  }
  return []
}

/**
 * Verify a recovery code against stored hashes.
 * Returns the index of the matching code, or -1 if not found.
 */
export async function verifyRecoveryCode(code: string, hashedCodes: unknown): Promise<number> {
  const codes = coerceRecoveryCodes(hashedCodes)

  for (let i = 0; i < codes.length; i++) {
    // Skip already-used codes (stored as empty string)
    if (!codes[i]) continue

    const isMatch = await verifyPassword(code, codes[i])
    if (isMatch) {
      return i
    }
  }

  return -1
}

/**
 * Mark a recovery code as used by clearing it from the array.
 * Returns the updated array (stored as native JSON in PostgreSQL).
 */
export function markRecoveryCodeUsed(hashedCodes: unknown, index: number): string[] {
  const codes = coerceRecoveryCodes(hashedCodes)
  codes[index] = '' // Mark as used
  return codes
}

/**
 * Count remaining (unused) recovery codes.
 */
export function countRemainingRecoveryCodes(hashedCodes: unknown): number {
  const codes = coerceRecoveryCodes(hashedCodes)
  return codes.filter((code) => code !== '').length
}
