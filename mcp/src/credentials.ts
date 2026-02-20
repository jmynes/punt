/**
 * MCP credential resolution
 *
 * Reads credentials from the user's config directory and resolves
 * the server configuration based on priority:
 *
 * 1. PUNT_API_KEY + PUNT_API_URL env vars (CI/automation)
 * 2. PUNT_SERVER env var -> lookup named server in credentials.json
 * 3. activeServer from credentials.json
 * 4. Fallback to "default" server
 *
 * Credentials file location:
 * - Linux: ~/.config/punt/credentials.json
 * - macOS: ~/Library/Application Support/punt/credentials.json
 * - Windows: %APPDATA%\punt\credentials.json
 */

import { existsSync, readFileSync } from 'node:fs'
import { getCredentialsPath } from './config.js'

/** How often (in ms) to re-read the credentials file */
const CACHE_TTL_MS = 5_000

/** Cached credentials */
let cachedCredentials: CredentialsFile | null = null

/** Timestamp of last file read */
let lastReadAt = 0

/** Path to credentials file (cached) */
let credentialsPath: string | null = null

/**
 * Server configuration
 */
export interface ServerConfig {
  url: string
  apiKey: string
}

/**
 * Individual server entry in credentials file
 */
interface ServerEntry {
  url: string
  apiKey: string
}

/**
 * Credentials file structure
 */
interface CredentialsFile {
  servers?: Record<string, ServerEntry>
  activeServer?: string
}

/**
 * Get or cache the credentials file path
 */
function getPath(): string {
  if (!credentialsPath) {
    credentialsPath = getCredentialsPath()
  }
  return credentialsPath
}

/**
 * Read and parse the credentials file.
 * Returns null if the file doesn't exist or is invalid.
 */
function readCredentialsFile(): CredentialsFile | null {
  try {
    const path = getPath()
    if (!existsSync(path)) {
      return null
    }
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as CredentialsFile
  } catch {
    // File doesn't exist, is empty, or has invalid JSON
    return null
  }
}

/**
 * Get credentials with caching (re-read every 5 seconds)
 */
function getCredentials(): CredentialsFile | null {
  const now = Date.now()

  if (now - lastReadAt >= CACHE_TTL_MS) {
    cachedCredentials = readCredentialsFile()
    lastReadAt = now
  }

  return cachedCredentials
}

/**
 * Resolve the server configuration to use.
 *
 * Priority:
 * 1. PUNT_API_KEY + PUNT_API_URL env vars
 * 2. PUNT_SERVER env var -> lookup in credentials.json
 * 3. activeServer from credentials.json
 * 4. "default" server from credentials.json
 *
 * Returns null if no valid configuration is found.
 */
export function resolveServer(): ServerConfig | null {
  // Priority 1: Environment variables (for CI/automation)
  const envKey = process.env.PUNT_API_KEY
  const envUrl = process.env.PUNT_API_URL
  if (envKey && envUrl) {
    return { url: envUrl, apiKey: envKey }
  }

  // Load credentials file
  const credentials = getCredentials()
  if (!credentials?.servers) {
    // No credentials file or no servers configured
    // Fall back to legacy env var behavior
    if (envKey) {
      return { url: envUrl ?? 'http://localhost:3000', apiKey: envKey }
    }
    return null
  }

  // Priority 2: PUNT_SERVER env var -> named server lookup
  const serverName = process.env.PUNT_SERVER
  if (serverName && credentials.servers[serverName]) {
    return credentials.servers[serverName]
  }

  // Priority 3: activeServer from credentials file
  if (credentials.activeServer && credentials.servers[credentials.activeServer]) {
    return credentials.servers[credentials.activeServer]
  }

  // Priority 4: "default" server
  if (credentials.servers.default) {
    return credentials.servers.default
  }

  // No valid server found
  return null
}

/**
 * Get just the API key (for backward compatibility with existing code)
 */
export function resolveApiKey(): string {
  const server = resolveServer()
  return server?.apiKey ?? ''
}

/**
 * Get just the API URL (for backward compatibility with existing code)
 */
export function resolveApiUrl(): string {
  const server = resolveServer()
  return server?.url ?? process.env.PUNT_API_URL ?? 'http://localhost:3000'
}

/**
 * Get the path where credentials should be stored.
 * Useful for displaying setup instructions to users.
 */
export function getCredentialsFilePath(): string {
  return getPath()
}
