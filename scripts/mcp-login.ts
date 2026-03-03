#!/usr/bin/env tsx
/**
 * CLI login command for MCP credential setup.
 *
 * Usage:
 *   pnpm mcp:login https://punt.example.com
 *   pnpm mcp:login http://localhost:3000
 *   npx punt-mcp login https://punt.example.com
 *
 * Flow:
 *   1. Prompts for username and password (password hidden)
 *   2. Authenticates via NextAuth credentials callback
 *   3. Generates a new MCP API key using the authenticated session
 *   4. Saves credentials to the platform-appropriate config directory
 *
 * Credentials file locations:
 *   - Linux:   ~/.config/punt/credentials.json
 *   - macOS:   ~/Library/Application Support/punt/credentials.json
 *   - Windows: %APPDATA%\punt\credentials.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'
import * as readline from 'node:readline'

// ============================================================================
// Terminal formatting helpers
// ============================================================================

const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function bold(text: string): string {
  return `${BOLD}${text}${RESET}`
}

function dim(text: string): string {
  return `${DIM}${text}${RESET}`
}

function red(text: string): string {
  return `${RED}${text}${RESET}`
}

function green(text: string): string {
  return `${GREEN}${text}${RESET}`
}

function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`
}

function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`
}

function error(message: string): void {
  console.error(`\n${red('Error:')} ${message}`)
}

function success(message: string): void {
  console.log(`\n${green('Success:')} ${message}`)
}

function info(message: string): void {
  console.log(`${cyan('>')} ${message}`)
}

// ============================================================================
// Cross-platform config directory resolution
// (Mirrors mcp/src/config.ts)
// ============================================================================

function getConfigDir(): string {
  const os = platform()

  if (os === 'win32') {
    const appData = process.env.APPDATA
    if (appData) {
      return join(appData, 'punt')
    }
    return join(homedir(), 'AppData', 'Roaming', 'punt')
  }

  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'punt')
  }

  // Linux and others: use XDG_CONFIG_HOME or ~/.config
  const xdgConfig = process.env.XDG_CONFIG_HOME
  if (xdgConfig) {
    return join(xdgConfig, 'punt')
  }
  return join(homedir(), '.config', 'punt')
}

function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json')
}

// ============================================================================
// Credentials file management
// ============================================================================

interface ServerEntry {
  url: string
  apiKey: string
}

interface CredentialsFile {
  servers: Record<string, ServerEntry>
  activeServer: string
}

function readCredentialsFile(): CredentialsFile {
  const path = getCredentialsPath()
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(content) as Partial<CredentialsFile>
      return {
        servers: parsed.servers ?? {},
        activeServer: parsed.activeServer ?? 'default',
      }
    } catch {
      // Invalid JSON - start fresh but warn
      console.warn(`${yellow('Warning:')} Could not parse existing ${path}, creating new file`)
    }
  }
  return { servers: {}, activeServer: 'default' }
}

function writeCredentialsFile(credentials: CredentialsFile): void {
  const path = getCredentialsPath()
  const dir = dirname(path)

  // Create directory if it doesn't exist
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }

  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 })
}

/**
 * Derive a server profile name from a URL.
 * - localhost URLs get "local"
 * - Other URLs get a sanitized hostname
 */
function deriveServerName(serverUrl: string): string {
  try {
    const url = new URL(serverUrl)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return 'local'
    }
    // Use hostname, replacing dots with dashes for readability
    return url.hostname.replace(/\./g, '-')
  } catch {
    return 'default'
  }
}

// ============================================================================
// HTTP request helper (Node.js stdlib only)
// ============================================================================

interface HttpResponse {
  statusCode: number
  headers: http.IncomingHttpHeaders
  body: string
}

function httpRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
  } = {},
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === 'https:'
    const transport = isHttps ? https : http

    const reqOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
    }

    const req = transport.request(reqOptions, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        })
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    // Set a reasonable timeout
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Request timed out'))
    })

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

/**
 * Extract Set-Cookie header values from a response.
 * Handles both string and string[] formats.
 */
function extractCookies(headers: http.IncomingHttpHeaders): string[] {
  const setCookie = headers['set-cookie']
  if (!setCookie) return []
  return Array.isArray(setCookie) ? setCookie : [setCookie]
}

/**
 * Build a Cookie header from Set-Cookie values.
 * Extracts just the cookie name=value pairs.
 */
function buildCookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

/**
 * Merge multiple cookie arrays, deduplicating by cookie name.
 * Later values override earlier ones (newest wins).
 */
function mergeCookies(...cookieArrays: string[][]): string[] {
  const map = new Map<string, string>()
  for (const cookies of cookieArrays) {
    for (const cookie of cookies) {
      const name = cookie.split('=')[0].trim()
      map.set(name, cookie)
    }
  }
  return Array.from(map.values())
}

/**
 * Detect whether a code looks like a recovery code vs a TOTP code.
 * Recovery codes are in format XXXXX-XXXXX (11 chars, alphanumeric with hyphen).
 * TOTP codes are exactly 6 numeric digits.
 */
function isRecoveryCode(code: string): boolean {
  const trimmed = code.trim()
  // TOTP codes are exactly 6 digits
  if (/^\d{6}$/.test(trimmed)) {
    return false
  }
  // Anything else (longer, contains letters/hyphens) is treated as a recovery code
  return true
}

// ============================================================================
// User input helpers
// ============================================================================

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const wasTTY = stdin.isTTY

    // Cleanup handler to restore terminal state on unexpected exit
    const cleanup = () => {
      if (wasTTY) {
        try {
          stdin.setRawMode(false)
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
    process.once('SIGTERM', cleanup)
    process.once('SIGINT', cleanup)
    process.once('exit', cleanup)

    if (wasTTY) {
      stdin.setRawMode(true)
    }

    let password = ''

    const onData = (data: Buffer): void => {
      const char = data.toString('utf-8')

      // Handle Enter/Return
      if (char === '\r' || char === '\n') {
        if (wasTTY) {
          stdin.setRawMode(false)
        }
        stdin.removeListener('data', onData)
        process.removeListener('SIGTERM', cleanup)
        process.removeListener('SIGINT', cleanup)
        process.removeListener('exit', cleanup)
        process.stdout.write('\n')
        resolve(password)
        return
      }

      // Handle Ctrl+C
      if (char === '\x03') {
        if (wasTTY) {
          stdin.setRawMode(false)
        }
        stdin.removeListener('data', onData)
        process.removeListener('SIGTERM', cleanup)
        process.removeListener('SIGINT', cleanup)
        process.removeListener('exit', cleanup)
        process.stdout.write('\n')
        process.exit(1)
      }

      // Handle Backspace/Delete
      if (char === '\x7f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }

      // Regular character
      password += char
      process.stdout.write('*')
    }

    stdin.resume()
    stdin.on('data', onData)
  })
}

// ============================================================================
// Authentication flow
// ============================================================================

/**
 * Authenticate with the PUNT server via NextAuth credentials flow.
 * Returns the session cookies on success.
 *
 * Flow:
 *   1. Fetch CSRF token
 *   2. Attempt sign-in via NextAuth callback
 *   3. If 2FA is required (detected from error response), prompt for code and retry
 *   4. Verify session
 */
async function authenticate(
  serverUrl: string,
  username: string,
  password: string,
): Promise<string[]> {
  // Step 1: Get CSRF token from NextAuth
  info('Fetching CSRF token...')
  const csrfRes = await httpRequest(`${serverUrl}/api/auth/csrf`)

  if (csrfRes.statusCode !== 200) {
    throw new Error(
      `Server returned ${csrfRes.statusCode} when fetching CSRF token. ` +
        'Is the PUNT server running at this URL?',
    )
  }

  let csrfToken: string
  try {
    const csrfData = JSON.parse(csrfRes.body) as { csrfToken: string }
    csrfToken = csrfData.csrfToken
  } catch {
    throw new Error('Could not parse CSRF response from server')
  }

  if (!csrfToken) {
    throw new Error('Server did not return a CSRF token')
  }

  // Collect cookies from CSRF response (session token cookie)
  const csrfCookies = extractCookies(csrfRes.headers)
  const cookieHeader = buildCookieHeader(csrfCookies)

  // Step 2: Attempt sign-in via NextAuth credentials callback
  info('Signing in...')
  const signInBody = new URLSearchParams()
  signInBody.set('username', username)
  signInBody.set('password', password)
  signInBody.set('csrfToken', csrfToken)
  signInBody.set('json', 'true')

  const signInRes = await httpRequest(`${serverUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: signInBody.toString(),
  })

  // Check if 2FA is required by examining the response URL for the error code.
  // NextAuth returns a JSON body with a "url" field containing error params when json=true.
  let signInCookies = extractCookies(signInRes.headers)
  let requires2FA = false

  try {
    const signInData = JSON.parse(signInRes.body) as { url?: string }
    if (signInData.url) {
      const responseUrl = new URL(signInData.url)
      const errorCode = responseUrl.searchParams.get('code')
      const errorParam = responseUrl.searchParams.get('error')

      if (errorCode === '2FA_REQUIRED') {
        requires2FA = true
      } else if (errorCode === 'RATE_LIMITED') {
        throw new Error(
          'Too many login attempts. For security, please wait 15 minutes before trying again.',
        )
      } else if (errorParam === 'CredentialsSignin') {
        throw new Error('Invalid username or password')
      }
    }
  } catch (e) {
    // Re-throw our own errors
    if (e instanceof Error && (e.message.includes('Too many') || e.message.includes('Invalid'))) {
      throw e
    }
    // If JSON parsing fails and we didn't get session cookies, the sign-in likely failed
    if (signInCookies.length === 0) {
      throw new Error('Authentication failed. Please check your credentials and try again.')
    }
  }

  // Step 3: If 2FA is required, prompt for code and retry
  if (requires2FA) {
    console.log(`\n${yellow('Two-factor authentication is enabled for this account.')}`)
    const totpCode = await prompt(`${bold('2FA Code (or recovery code):')} `)
    if (!totpCode) {
      throw new Error('2FA code is required')
    }

    const useRecovery = isRecoveryCode(totpCode)
    if (useRecovery) {
      info('Using recovery code...')
    }

    const retryBody = new URLSearchParams()
    retryBody.set('username', username)
    retryBody.set('password', password)
    retryBody.set('csrfToken', csrfToken)
    retryBody.set('json', 'true')
    retryBody.set('totpCode', totpCode)
    if (useRecovery) {
      retryBody.set('isRecoveryCode', 'true')
    }

    const retryRes = await httpRequest(`${serverUrl}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: retryBody.toString(),
    })

    signInCookies = extractCookies(retryRes.headers)

    // Check for errors in the retry response
    try {
      const retryData = JSON.parse(retryRes.body) as { url?: string }
      if (retryData.url) {
        const retryUrl = new URL(retryData.url)
        const retryErrorCode = retryUrl.searchParams.get('code')
        const retryError = retryUrl.searchParams.get('error')

        if (retryErrorCode === 'RATE_LIMITED') {
          throw new Error(
            'Too many verification attempts. For security, please wait 15 minutes before trying again.',
          )
        }
        if (retryErrorCode === 'INVALID_2FA_CODE' || retryError === 'CredentialsSignin') {
          throw new Error(
            useRecovery
              ? 'Invalid recovery code. Make sure you are using an unused code (format: XXXXX-XXXXX).'
              : 'Invalid verification code. Make sure the code matches your authenticator app.',
          )
        }
      }
    } catch (e) {
      if (e instanceof Error && (e.message.includes('Too many') || e.message.includes('Invalid'))) {
        throw e
      }
    }
  }

  // Merge all cookies, deduplicating by name (newest wins)
  const allCookies = mergeCookies(csrfCookies, signInCookies)
  const sessionCookie = buildCookieHeader(allCookies)

  if (!sessionCookie) {
    throw new Error('Authentication failed: no session cookie received')
  }

  // Verify the session is valid by checking /api/auth/session
  const sessionRes = await httpRequest(`${serverUrl}/api/auth/session`, {
    headers: {
      Cookie: sessionCookie,
    },
  })

  if (sessionRes.statusCode !== 200) {
    throw new Error('Authentication failed: could not verify session')
  }

  let sessionData: { user?: { name?: string } }
  try {
    sessionData = JSON.parse(sessionRes.body) as { user?: { name?: string } }
  } catch {
    throw new Error('Authentication failed: invalid session response')
  }

  if (!sessionData.user) {
    throw new Error('Authentication failed. Please check your credentials and try again.')
  }

  info(`Authenticated as ${bold(sessionData.user.name ?? username)}`)
  return allCookies
}

/**
 * Generate a new MCP API key using the authenticated session.
 * The MCP key endpoint requires password re-authentication.
 */
async function generateMcpKey(
  serverUrl: string,
  cookies: string[],
  password: string,
): Promise<string> {
  info('Generating MCP API key...')
  const cookieHeader = buildCookieHeader(cookies)

  const res = await httpRequest(`${serverUrl}/api/me/mcp-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ password }),
  })

  if (res.statusCode === 401) {
    let errorData: { error?: string; requires2fa?: boolean }
    try {
      errorData = JSON.parse(res.body) as { error?: string; requires2fa?: boolean }
    } catch {
      throw new Error('Failed to generate API key: authentication error')
    }

    if (errorData.requires2fa) {
      // Need 2FA for key generation too
      const totpCode = await prompt(`${bold('2FA Code (for key generation, or recovery code):')} `)
      if (!totpCode) {
        throw new Error('2FA code is required for API key generation')
      }

      const useRecovery = isRecoveryCode(totpCode)
      if (useRecovery) {
        info('Using recovery code...')
      }

      const retryRes = await httpRequest(`${serverUrl}/api/me/mcp-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          password,
          totpCode,
          ...(useRecovery ? { isRecoveryCode: true } : {}),
        }),
      })

      if (retryRes.statusCode !== 200) {
        throw new Error(`Failed to generate API key: ${retryRes.body}`)
      }

      const retryData = JSON.parse(retryRes.body) as { apiKey: string }
      return retryData.apiKey
    }

    throw new Error(`Failed to generate API key: ${errorData.error ?? 'unknown error'}`)
  }

  if (res.statusCode !== 200) {
    let errorMsg = `HTTP ${res.statusCode}`
    try {
      const errorData = JSON.parse(res.body) as { error?: string }
      errorMsg = errorData.error ?? errorMsg
    } catch {
      // Use status code
    }
    throw new Error(`Failed to generate API key: ${errorMsg}`)
  }

  let data: { apiKey: string }
  try {
    data = JSON.parse(res.body) as { apiKey: string }
  } catch {
    throw new Error('Failed to parse API key response')
  }

  if (!data.apiKey) {
    throw new Error('Server did not return an API key')
  }

  return data.apiKey
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2)

  // Handle "login" subcommand (for npx usage: npx punt-mcp login <url>)
  let serverUrl: string | undefined
  if (args[0] === 'login') {
    serverUrl = args[1]
  } else {
    serverUrl = args[0]
  }

  // Show help
  if (!serverUrl || serverUrl === '--help' || serverUrl === '-h') {
    console.log(`
${bold('PUNT MCP Login')} - Configure MCP credentials

${bold('Usage:')}
  pnpm mcp:login <server-url>
  npx punt-mcp login <server-url>

${bold('Examples:')}
  pnpm mcp:login http://localhost:3000
  pnpm mcp:login https://punt.example.com

${bold('Description:')}
  Authenticates with a PUNT server and saves MCP API credentials
  to your local config directory for use with the MCP server.

${bold('Credentials location:')}
  ${dim(getCredentialsPath())}
`)
    process.exit(serverUrl ? 0 : 1)
  }

  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(serverUrl)
  } catch {
    error(`Invalid URL: ${serverUrl}`)
    console.log(
      `  Expected format: ${dim('https://punt.example.com')} or ${dim('http://localhost:3000')}`,
    )
    process.exit(1)
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    error(`Unsupported protocol: ${parsedUrl.protocol}`)
    console.log(`  Only ${dim('http://')} and ${dim('https://')} are supported`)
    process.exit(1)
  }

  // Remove trailing slash
  serverUrl = parsedUrl.origin

  // Print header
  console.log(`\n${bold('PUNT MCP Login')}`)
  console.log(dim(`Server: ${serverUrl}`))
  console.log()

  // Check server connectivity
  try {
    info('Checking server connectivity...')
    const healthRes = await httpRequest(`${serverUrl}/api/auth/csrf`)
    if (healthRes.statusCode !== 200) {
      throw new Error(`Server returned HTTP ${healthRes.statusCode}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    error(`Could not connect to ${serverUrl}`)
    console.log(`  ${dim(msg)}`)
    console.log(`\n  Make sure the PUNT server is running and accessible.`)
    process.exit(1)
  }

  // Prompt for credentials
  const username = await prompt(`${bold('Username:')} `)
  if (!username) {
    error('Username is required')
    process.exit(1)
  }

  const password = await promptPassword(`${bold('Password:')} `)
  if (!password) {
    error('Password is required')
    process.exit(1)
  }

  try {
    // Authenticate
    const cookies = await authenticate(serverUrl, username, password)

    // Generate MCP API key
    const apiKey = await generateMcpKey(serverUrl, cookies, password)

    // Save credentials
    const credentialsFile = readCredentialsFile()
    const serverName = deriveServerName(serverUrl)

    // Check if this server already has an entry
    const existingEntry = Object.entries(credentialsFile.servers).find(
      ([, entry]) => entry.url === serverUrl,
    )

    let profileName: string
    if (existingEntry) {
      // Update existing entry
      profileName = existingEntry[0]
      credentialsFile.servers[profileName].apiKey = apiKey
      info(`Updated existing profile ${bold(profileName)}`)
    } else {
      // Create new entry
      profileName = serverName
      credentialsFile.servers[profileName] = { url: serverUrl, apiKey }
      info(`Created profile ${bold(profileName)}`)
    }

    // Always update activeServer to the server just authenticated
    credentialsFile.activeServer = profileName

    writeCredentialsFile(credentialsFile)

    const credPath = getCredentialsPath()
    success('MCP credentials configured!')
    console.log()
    console.log(`  ${dim('Profile:')}     ${profileName}`)
    console.log(`  ${dim('Server:')}      ${serverUrl}`)
    console.log(`  ${dim('API Key:')}     ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)
    console.log(`  ${dim('Saved to:')}    ${credPath}`)
    console.log()

    // Show .mcp.json setup instructions
    console.log(bold('Next steps:'))
    console.log()
    console.log(`  Add this to your project's ${cyan('.mcp.json')} to enable the MCP server:`)
    console.log()
    console.log(dim('  {'))
    console.log(dim('    "mcpServers": {'))
    console.log(dim('      "punt": {'))
    console.log(dim('        "type": "stdio",'))
    console.log(dim('        "command": "pnpm",'))
    console.log(dim('        "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"]'))
    console.log(dim('      }'))
    console.log(dim('    }'))
    console.log(dim('  }'))
    console.log()
    console.log(`  The MCP server will automatically read credentials from ${dim(credPath)}`)
    console.log()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
    error(msg)
    process.exit(1)
  }
}

main().catch((err) => {
  error(err instanceof Error ? err.message : 'An unexpected error occurred')
  process.exit(1)
})
