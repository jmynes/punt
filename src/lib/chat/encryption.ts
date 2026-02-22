/**
 * Encryption utilities for Claude session credentials
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recommended IV length
const TAG_LENGTH = 16 // Auth tag length
const SALT_LENGTH = 16

/**
 * Get encryption key from environment or throw
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_ENCRYPTION_SECRET environment variable is required for session encryption',
    )
  }

  // Derive a 32-byte key using scrypt
  // We use a static salt derived from the secret itself for determinism
  // This is acceptable since we also use random IVs for each encryption
  const salt = scryptSync(secret, 'punt-session-salt', SALT_LENGTH)
  return scryptSync(secret, salt, 32)
}

/**
 * Encrypt session credentials
 * @param plaintext - The credentials JSON string to encrypt
 * @returns Base64-encoded encrypted data (iv:authTag:ciphertext)
 */
export function encryptSession(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Combine iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString('base64')
}

/**
 * Decrypt session credentials
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Decrypted credentials JSON string
 */
export function decryptSession(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract iv, authTag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Validate that a decrypted session has the expected structure
 * Supports both formats:
 * - New format: { claudeAiOauth: { accessToken, refreshToken, ... } }
 * - Legacy format: { accessToken, refreshToken, ... }
 */
export function validateSessionCredentials(credentials: unknown): credentials is ClaudeCredentials {
  if (typeof credentials !== 'object' || credentials === null) {
    return false
  }

  const creds = credentials as Record<string, unknown>

  // Check for new format: claudeAiOauth.accessToken
  if (creds.claudeAiOauth && typeof creds.claudeAiOauth === 'object') {
    const oauth = creds.claudeAiOauth as Record<string, unknown>
    if (typeof oauth.accessToken === 'string' && oauth.accessToken) {
      return true
    }
  }

  // Check for legacy format: top-level accessToken
  if (typeof creds.accessToken === 'string' && creds.accessToken) {
    return true
  }

  return false
}

/**
 * Extract the OAuth credentials from either format
 */
export function extractOAuthCredentials(credentials: ClaudeCredentials): OAuthCredentials {
  if (credentials.claudeAiOauth) {
    return credentials.claudeAiOauth as OAuthCredentials
  }
  return credentials as unknown as OAuthCredentials
}

export interface OAuthCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  [key: string]: unknown
}

export interface ClaudeCredentials {
  claudeAiOauth?: OAuthCredentials
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  mcpOauth?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Extract available MCP server names from credentials
 * MCP OAuth tokens are stored under the 'mcpOauth' key
 */
export function extractMcpServerNames(credentials: ClaudeCredentials): string[] {
  if (!credentials.mcpOauth || typeof credentials.mcpOauth !== 'object') {
    return []
  }
  return Object.keys(credentials.mcpOauth).filter(
    (key) => key !== 'punt', // Exclude PUNT since it's always available
  )
}
