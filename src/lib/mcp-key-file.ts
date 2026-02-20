/**
 * MCP key file management
 *
 * Writes/clears the .mcp-key file in the project root when a user
 * generates or revokes their MCP API key. This enables the MCP server
 * to hot-reload the key without restarting.
 *
 * The key file path can be overridden via MCP_KEY_FILE env var.
 */

import { unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { logger } from '@/lib/logger'

/**
 * Get the path to the MCP key file.
 * Defaults to .mcp-key in the project root (process.cwd()).
 */
function getKeyFilePath(): string {
  return process.env.MCP_KEY_FILE ?? resolve(process.cwd(), '.mcp-key')
}

/**
 * Write the API key to the key file.
 * This is called when a user generates a new MCP API key.
 */
export function writeMcpKeyFile(apiKey: string): void {
  try {
    const filePath = getKeyFilePath()
    writeFileSync(filePath, apiKey, { encoding: 'utf-8', mode: 0o600 })
    logger.info('MCP key file updated')
  } catch (error) {
    // Non-fatal: key file is a convenience feature, env var fallback exists
    logger.warn('Failed to write MCP key file:', error)
  }
}

/**
 * Remove the key file.
 * This is called when a user revokes their MCP API key.
 */
export function clearMcpKeyFile(): void {
  try {
    const filePath = getKeyFilePath()
    unlinkSync(filePath)
    logger.info('MCP key file removed')
  } catch (error) {
    // File might not exist, which is fine
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('Failed to remove MCP key file:', error)
    }
  }
}
