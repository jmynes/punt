/**
 * Cross-platform configuration directory resolution
 *
 * Finds the appropriate user config directory on each platform:
 * - Linux: ~/.config/punt (or $XDG_CONFIG_HOME/punt)
 * - macOS: ~/Library/Application Support/punt
 * - Windows: %APPDATA%\punt
 */

import { homedir, platform } from 'node:os'
import { join } from 'node:path'

/**
 * Get the platform-appropriate config directory for PUNT.
 */
export function getConfigDir(): string {
  const os = platform()

  if (os === 'win32') {
    // Windows: use APPDATA
    const appData = process.env.APPDATA
    if (appData) {
      return join(appData, 'punt')
    }
    // Fallback to user profile
    return join(homedir(), 'AppData', 'Roaming', 'punt')
  }

  if (os === 'darwin') {
    // macOS: use Application Support
    return join(homedir(), 'Library', 'Application Support', 'punt')
  }

  // Linux and others: use XDG_CONFIG_HOME or ~/.config
  const xdgConfig = process.env.XDG_CONFIG_HOME
  if (xdgConfig) {
    return join(xdgConfig, 'punt')
  }
  return join(homedir(), '.config', 'punt')
}

/**
 * Get the path to the credentials file.
 */
export function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json')
}
