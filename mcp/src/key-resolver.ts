/**
 * Dynamic MCP API key resolver
 *
 * Reads the API key from a key file (.mcp-key) in the project root,
 * falling back to the MCP_API_KEY environment variable.
 *
 * The key file is automatically updated when a user generates or
 * revokes their MCP API key via the PUNT UI, enabling hot-reload
 * without restarting Claude Code or the dev server.
 *
 * The file is re-read at most every 5 seconds to avoid excessive I/O.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** How often (in ms) to re-read the key file */
const CACHE_TTL_MS = 5_000

/** Cached key value */
let cachedKey: string | null = null

/** Timestamp of last file read */
let lastReadAt = 0

/**
 * Path to the key file. Located in the PUNT project root (parent of mcp/).
 * Can be overridden via MCP_KEY_FILE env var for custom deployments.
 */
const keyFilePath = process.env.MCP_KEY_FILE ?? resolve(import.meta.dirname, '../../.mcp-key')

/**
 * Read the API key from the key file.
 * Returns null if the file doesn't exist or is empty.
 */
function readKeyFile(): string | null {
  try {
    const content = readFileSync(keyFilePath, 'utf-8').trim()
    return content || null
  } catch {
    // File doesn't exist or can't be read - that's fine
    return null
  }
}

/**
 * Resolve the current MCP API key.
 *
 * Priority:
 * 1. Key file (.mcp-key) - re-read every 5 seconds
 * 2. MCP_API_KEY environment variable (static fallback)
 *
 * Returns empty string if no key is available.
 */
export function resolveApiKey(): string {
  const now = Date.now()

  if (now - lastReadAt >= CACHE_TTL_MS) {
    cachedKey = readKeyFile()
    lastReadAt = now
  }

  return cachedKey ?? process.env.MCP_API_KEY ?? ''
}
