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
  mcpOAuth?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Filter credentials to only include OAuth tokens for the specified MCP servers.
 * This ensures only user-enabled external servers are available when spawning Claude CLI.
 */
export function filterCredentialsMcpServers(
  credentials: ClaudeCredentials,
  enabledServers: string[],
): ClaudeCredentials {
  if (!credentials.mcpOAuth || typeof credentials.mcpOAuth !== 'object') {
    return credentials
  }

  const enabledSet = new Set(enabledServers)
  const filteredOAuth: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(credentials.mcpOAuth)) {
    // Extract friendly server name, matching extractMcpServerDetails logic
    const keyWithoutId = key.split('|')[0]
    const serverName = keyWithoutId.startsWith('plugin:')
      ? (keyWithoutId.split(':').pop() ?? keyWithoutId)
      : keyWithoutId
    if (enabledSet.has(serverName)) {
      filteredOAuth[key] = value
    }
  }

  return {
    ...credentials,
    mcpOAuth: filteredOAuth,
  }
}

/**
 * Details about an external MCP server discovered from credentials
 */
export interface McpServerInfo {
  /** Friendly display name (e.g. "github", "linear") */
  name: string
  /** Raw key from mcpOAuth (e.g. "github|abc123") */
  key: string
  /** Whether the OAuth token has expired */
  tokenExpired: boolean
  /** Token expiry timestamp (ms since epoch), if available */
  tokenExpiresAt: number | null
}

/**
 * Extract available MCP server names from credentials
 * MCP OAuth tokens are stored under the 'mcpOAuth' key (note capital O)
 */
export function extractMcpServerNames(credentials: ClaudeCredentials): string[] {
  return extractMcpServerDetails(credentials).map((s) => s.name)
}

/**
 * Extract detailed MCP server info from credentials, including token status.
 * MCP OAuth tokens are stored under the 'mcpOAuth' key (note capital O).
 */
export function extractMcpServerDetails(credentials: ClaudeCredentials): McpServerInfo[] {
  if (!credentials.mcpOAuth || typeof credentials.mcpOAuth !== 'object') {
    return []
  }

  const seen = new Set<string>()
  const servers: McpServerInfo[] = []

  for (const key of Object.keys(credentials.mcpOAuth)) {
    // Skip the built-in PUNT server
    if (key === 'punt') continue

    // Extract friendly server name from key formats:
    // - Regular: "serverName|id" → "serverName"
    // - Plugin: "plugin:provider:name|id" → "name"
    const keyWithoutId = key.split('|')[0]
    const serverName = keyWithoutId.startsWith('plugin:')
      ? (keyWithoutId.split(':').pop() ?? keyWithoutId)
      : keyWithoutId
    if (seen.has(serverName)) continue
    seen.add(serverName)

    // Extract token expiry info if available.
    // When multiple keys share a server name (e.g. "github|abc", "github|def"),
    // we report the first key's expiry (insertion-order). filterCredentialsMcpServers
    // passes all matching keys through, so this is a display-only approximation.
    const tokenData = credentials.mcpOAuth[key]
    let tokenExpiresAt: number | null = null
    let tokenExpired = false

    if (tokenData && typeof tokenData === 'object') {
      const data = tokenData as Record<string, unknown>
      const rawExpiry =
        typeof data.expiresAt === 'number'
          ? data.expiresAt
          : typeof data.expires_at === 'number'
            ? data.expires_at
            : null

      if (rawExpiry !== null) {
        // OAuth tokens commonly use seconds; Claude CLI may use milliseconds.
        // Heuristic: values < 1e12 are seconds (before year 33658 in ms, ~2001 in s).
        tokenExpiresAt = rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry
        tokenExpired = tokenExpiresAt < Date.now()
      }
    }

    servers.push({
      name: serverName,
      key,
      tokenExpired,
      tokenExpiresAt,
    })
  }

  return servers
}
