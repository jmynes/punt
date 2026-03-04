/**
 * PUNT Guided Installer
 *
 * Interactive setup script that walks users through:
 * 1. PostgreSQL detection and database creation
 * 2. Environment configuration (.env file)
 * 3. Dependency installation
 * 4. Prisma schema push and client generation
 * 5. Admin user creation
 *
 * Usage: pnpm run setup
 */

import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

// ---------------------------------------------------------------------------
// Terminal colors & formatting
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const CYAN = '\x1b[36m'

const fmt = {
  bold: (s: string) => `${BOLD}${s}${RESET}`,
  dim: (s: string) => `${DIM}${s}${RESET}`,
  red: (s: string) => `${RED}${s}${RESET}`,
  green: (s: string) => `${GREEN}${s}${RESET}`,
  yellow: (s: string) => `${YELLOW}${s}${RESET}`,
  blue: (s: string) => `${BLUE}${s}${RESET}`,
  cyan: (s: string) => `${CYAN}${s}${RESET}`,
  success: (s: string) => `${GREEN}${BOLD}${s}${RESET}`,
  error: (s: string) => `${RED}${BOLD}${s}${RESET}`,
  header: (s: string) => `${CYAN}${BOLD}${s}${RESET}`,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = new URL('..', import.meta.url).pathname

function banner() {
  console.log('')
  console.log(fmt.header('  ========================================'))
  console.log(fmt.header('       PUNT - Guided Installer'))
  console.log(fmt.header('  ========================================'))
  console.log('')
}

function stepHeader(step: number, total: number, title: string) {
  console.log('')
  console.log(fmt.bold(`  Step ${step}/${total}: ${title}`))
  console.log(fmt.dim(`  ${'-'.repeat(40)}`))
}

function info(msg: string) {
  console.log(`  ${fmt.blue('i')} ${msg}`)
}

function success(msg: string) {
  console.log(`  ${fmt.green('+')} ${msg}`)
}

function warn(msg: string) {
  console.log(`  ${fmt.yellow('!')} ${msg}`)
}

function fail(msg: string) {
  console.log(`  ${fmt.red('x')} ${msg}`)
}

/** Run a shell command, printing output. Returns true on success. */
function run(cmd: string, opts?: { silent?: boolean; cwd?: string }): boolean {
  const cwd = opts?.cwd ?? ROOT
  if (!opts?.silent) {
    console.log(`  ${fmt.dim(`$ ${cmd}`)}`)
  }
  try {
    execSync(cmd, { cwd, stdio: opts?.silent ? 'pipe' : 'inherit' })
    return true
  } catch {
    return false
  }
}

/** Run a shell command and return stdout, or null on failure. */
function runCapture(cmd: string): string | null {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

/** Simple readline-based prompting. */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  function ask(question: string, defaultValue?: string): Promise<string> {
    const suffix = defaultValue != null ? ` ${fmt.dim(`[${defaultValue}]`)}` : ''
    return new Promise((resolve) => {
      rl.question(`  ${fmt.cyan('?')} ${question}${suffix} `, (answer) => {
        resolve(answer.trim() || defaultValue || '')
      })
    })
  }

  function askYesNo(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? 'Y/n' : 'y/N'
    return new Promise((resolve) => {
      rl.question(`  ${fmt.cyan('?')} ${question} ${fmt.dim(`(${hint})`)} `, (answer) => {
        const a = answer.trim().toLowerCase()
        if (a === '') resolve(defaultYes)
        else resolve(a === 'y' || a === 'yes')
      })
    })
  }

  /** Read a password without echoing (using raw mode). */
  function askPassword(question: string): Promise<string> {
    return new Promise((resolve) => {
      const stdin = process.stdin
      const stdout = process.stdout

      stdout.write(`  ${fmt.cyan('?')} ${question} `)

      // If stdin is not a TTY (piped input), fall back to normal readline
      if (!stdin.isTTY) {
        rl.question('', (answer) => {
          resolve(answer.trim())
        })
        return
      }

      // Pause readline so it doesn't interfere with raw stdin
      rl.pause()

      const raw = stdin.isRaw
      stdin.setRawMode(true)
      stdin.resume()

      let password = ''

      const onData = (data: Buffer) => {
        const ch = data.toString()
        // Enter
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(raw ?? false)
          stdin.removeListener('data', onData)
          stdout.write('\n')
          rl.resume()
          resolve(password)
        }
        // Ctrl+C
        else if (ch === '\x03') {
          stdin.setRawMode(raw ?? false)
          stdout.write('\n')
          process.exit(1)
        }
        // Backspace
        else if (ch === '\x7f' || ch === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1)
            stdout.write('\b \b')
          }
        }
        // Regular character
        else {
          password += ch
          stdout.write('*')
        }
      }

      stdin.on('data', onData)
    })
  }

  function close() {
    rl.close()
  }

  return { ask, askYesNo, askPassword, close }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be between 3 and 30 characters' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens',
    }
  }
  return { valid: true }
}

function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  return { valid: errors.length === 0, errors }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Validate a PostgreSQL identifier (database name, username) against a strict allowlist. */
function isValidIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) && value.length <= 63
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function detectPlatform(): 'macos' | 'linux' {
  const platform = process.platform
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

function checkPostgres(): boolean {
  return runCapture('which psql') !== null
}

function printInstallInstructions(platform: 'macos' | 'linux') {
  console.log('')
  if (platform === 'macos') {
    info('Install PostgreSQL on macOS:')
    console.log('')
    console.log(fmt.dim('    # Using Homebrew (recommended):'))
    console.log(`    ${fmt.bold('brew install postgresql@16')}`)
    console.log(`    ${fmt.bold('brew services start postgresql@16')}`)
    console.log('')
    console.log(fmt.dim('    # Or download from:'))
    console.log(`    ${fmt.bold('https://www.postgresql.org/download/macosx/')}`)
  } else {
    info('Install PostgreSQL on Linux:')
    console.log('')
    console.log(fmt.dim('    # Debian/Ubuntu:'))
    console.log(`    ${fmt.bold('sudo apt install postgresql postgresql-client')}`)
    console.log(`    ${fmt.bold('sudo systemctl start postgresql')}`)
    console.log('')
    console.log(fmt.dim('    # Fedora/RHEL:'))
    console.log(`    ${fmt.bold('sudo dnf install postgresql-server postgresql')}`)
    console.log(`    ${fmt.bold('sudo postgresql-setup --initdb')}`)
    console.log(`    ${fmt.bold('sudo systemctl start postgresql')}`)
    console.log('')
    console.log(fmt.dim('    # Arch Linux:'))
    console.log(`    ${fmt.bold('sudo pacman -S postgresql')}`)
    console.log(`    ${fmt.bold('sudo -u postgres initdb -D /var/lib/postgres/data')}`)
    console.log(`    ${fmt.bold('sudo systemctl start postgresql')}`)
  }
  console.log('')
  info('After installing, re-run: pnpm run setup')
}

/** Run a shell command with environment variables and return stdout, or null on failure. */
function runCaptureEnv(cmd: string, env?: Record<string, string>): string | null {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : undefined,
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

/** Try to create a database via psql. Returns true on success. */
function createDatabase(
  dbName: string,
  dbUser: string,
  dbPassword: string,
  dbHost: string,
  dbPort: string,
): { success: boolean; alreadyExists?: boolean } {
  // Check if database already exists using a precise pg_database query
  const exists = runCapture(
    `sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`,
  )

  if (exists === null) {
    // Connection to PostgreSQL failed entirely
    warn('Could not connect to PostgreSQL to check database existence.')
  } else if (exists.trim() === '1') {
    return { success: true, alreadyExists: true }
  }

  // Try via the postgres superuser first (uses peer auth, no password needed)
  const sudoCreate = runCapture(
    `sudo -u postgres psql -c "CREATE DATABASE ${dbName} OWNER ${dbUser};" 2>&1`,
  )
  if (sudoCreate !== null && !sudoCreate.includes('ERROR')) {
    return { success: true }
  }

  // Fall back to connecting as the specified user with PGPASSWORD
  const createDb = runCaptureEnv(
    `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -c "CREATE DATABASE ${dbName};" 2>&1`,
    { PGPASSWORD: dbPassword },
  )
  if (createDb !== null && !createDb.includes('ERROR')) {
    return { success: true }
  }

  return { success: false }
}

/** Try to create a PostgreSQL user. Password is piped via stdin to avoid exposure in process list. */
function createPgUser(
  dbUser: string,
  dbPassword: string,
): { success: boolean; alreadyExists?: boolean } {
  // Check if user exists
  const exists = runCapture(
    `sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${dbUser}'"`,
  )

  if (exists?.trim() === '1') {
    return { success: true, alreadyExists: true }
  }

  // Escape single quotes in password for SQL
  const escapedPassword = dbPassword.replace(/'/g, "''")
  const sql = `CREATE USER ${dbUser} WITH PASSWORD '${escapedPassword}' CREATEDB;`

  try {
    execSync('sudo -u postgres psql', {
      cwd: ROOT,
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}

function generateAuthSecret(): string {
  // Try openssl first
  const secret = runCapture('openssl rand -base64 32')
  if (secret) return secret

  // Fallback to Node.js crypto
  return randomBytes(32).toString('base64')
}

function buildEnvFile(vars: Record<string, string>): string {
  const examplePath = `${ROOT}.env.example`
  let template: string

  if (existsSync(examplePath)) {
    template = readFileSync(examplePath, 'utf-8')
  } else {
    // Minimal fallback template
    template = [
      '# PUNT Environment Configuration',
      '# Generated by pnpm setup',
      '',
      'DATABASE_URL="postgresql://punt:punt@localhost:5432/punt"',
      'AUTH_SECRET="your-secret-key-here"',
      '# NEXT_PUBLIC_DEMO_MODE=true',
      'NEXT_PUBLIC_DEBUG=false',
      'TRUST_PROXY=false',
      '',
    ].join('\n')
  }

  let result = template

  // Replace placeholder values with actual values
  for (const [key, value] of Object.entries(vars)) {
    // Match both quoted and unquoted values, and commented-out lines
    const patterns = [
      // DATABASE_URL="..." or AUTH_SECRET="..."
      new RegExp(`^${key}="[^"]*"`, 'm'),
      // DATABASE_URL=... (unquoted)
      new RegExp(`^${key}=[^\\n]*`, 'm'),
      // # DATABASE_URL="..." (commented out)
      new RegExp(`^#\\s*${key}="[^"]*"`, 'm'),
      // # DATABASE_URL=... (commented out, unquoted)
      new RegExp(`^#\\s*${key}=[^\\n]*`, 'm'),
    ]

    let replaced = false
    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, `${key}="${value}"`)
        replaced = true
        break
      }
    }

    // If key wasn't found in template, append it
    if (!replaced) {
      result = `${result.trimEnd()}\n${key}="${value}"\n`
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  banner()

  const prompt = createPrompter()
  const platform = detectPlatform()
  const TOTAL_STEPS = 6

  info(`Detected platform: ${fmt.bold(platform)}`)
  info(`Project root: ${fmt.dim(ROOT)}`)

  // ----------------------------------------------------------
  // Ask about demo mode first
  // ----------------------------------------------------------
  console.log('')
  const wantDemo = await prompt.askYesNo(
    'Would you like to set up in demo mode (no database required)?',
    false,
  )

  if (wantDemo) {
    await setupDemoMode(prompt)
    prompt.close()
    return
  }

  // ----------------------------------------------------------
  // Step 1: Detect PostgreSQL
  // ----------------------------------------------------------
  stepHeader(1, TOTAL_STEPS, 'PostgreSQL Detection')

  if (checkPostgres()) {
    const version = runCapture('psql --version')
    success(`PostgreSQL found: ${version}`)
  } else {
    fail('PostgreSQL (psql) not found on your PATH.')
    printInstallInstructions(platform)
    prompt.close()
    process.exit(1)
  }

  // ----------------------------------------------------------
  // Step 2: Database setup
  // ----------------------------------------------------------
  stepHeader(2, TOTAL_STEPS, 'Database Setup')

  const dbUser = await prompt.ask('PostgreSQL username:', 'punt')
  if (!isValidIdentifier(dbUser)) {
    fail(
      `Invalid username "${dbUser}". Must start with a letter or underscore, contain only alphanumerics/underscores, and be at most 63 characters.`,
    )
    prompt.close()
    process.exit(1)
  }

  const dbPassword = await prompt.askPassword('PostgreSQL password (default: punt):')
  const effectiveDbPassword = dbPassword || 'punt'
  const dbHost = await prompt.ask('PostgreSQL host:', 'localhost')
  if (!/^[a-zA-Z0-9._-]+$/.test(dbHost)) {
    fail(
      `Invalid host "${dbHost}". Must contain only alphanumeric characters, dots, hyphens, and underscores.`,
    )
    prompt.close()
    process.exit(1)
  }
  const dbPort = await prompt.ask('PostgreSQL port:', '5432')
  if (!/^\d{1,5}$/.test(dbPort) || Number(dbPort) < 1 || Number(dbPort) > 65535) {
    fail(`Invalid port "${dbPort}". Must be a number between 1 and 65535.`)
    prompt.close()
    process.exit(1)
  }
  const dbName = await prompt.ask('Database name:', 'punt')

  if (!isValidIdentifier(dbName)) {
    fail(
      `Invalid database name "${dbName}". Must start with a letter or underscore, contain only alphanumerics/underscores, and be at most 63 characters.`,
    )
    prompt.close()
    process.exit(1)
  }

  const databaseUrl = `postgresql://${dbUser}:${effectiveDbPassword}@${dbHost}:${dbPort}/${dbName}`

  info('Attempting to create PostgreSQL user...')
  const userResult = createPgUser(dbUser, effectiveDbPassword)
  if (userResult.alreadyExists) {
    success(`User "${dbUser}" already exists.`)
  } else if (userResult.success) {
    success(`User "${dbUser}" created.`)
  } else {
    warn(`Could not auto-create user "${dbUser}".`)
    info('You may need to create it manually:')
    console.log(
      fmt.dim(`    sudo -u postgres psql -c "CREATE USER ${dbUser} WITH PASSWORD '...' CREATEDB;"`),
    )
  }

  info(`Creating database "${dbName}"...`)
  const dbResult = createDatabase(dbName, dbUser, effectiveDbPassword, dbHost, dbPort)
  if (dbResult.alreadyExists) {
    success(`Database "${dbName}" already exists.`)
  } else if (dbResult.success) {
    success(`Database "${dbName}" created.`)
  } else {
    warn(`Could not auto-create database "${dbName}".`)
    info('You may need to create it manually:')
    console.log(
      fmt.dim(`    sudo -u postgres psql -c "CREATE DATABASE ${dbName} OWNER ${dbUser};"`),
    )
  }

  // Optionally create test database
  const wantTestDb = await prompt.askYesNo('Create a test database (for running tests)?', false)
  let testDatabaseUrl: string | undefined

  if (wantTestDb) {
    const testDbName = `${dbName}_test`
    const testResult = createDatabase(testDbName, dbUser, effectiveDbPassword, dbHost, dbPort)
    testDatabaseUrl = `postgresql://${dbUser}:${effectiveDbPassword}@${dbHost}:${dbPort}/${testDbName}`

    if (testResult.alreadyExists) {
      success(`Test database "${testDbName}" already exists.`)
    } else if (testResult.success) {
      success(`Test database "${testDbName}" created.`)
    } else {
      warn(`Could not auto-create test database "${testDbName}".`)
    }
  }

  // ----------------------------------------------------------
  // Step 3: Generate .env
  // ----------------------------------------------------------
  stepHeader(3, TOTAL_STEPS, 'Environment Configuration')

  const envPath = `${ROOT}.env`
  const envExists = existsSync(envPath)

  if (envExists) {
    warn('.env file already exists.')
    const overwrite = await prompt.askYesNo('Overwrite existing .env file?', false)
    if (!overwrite) {
      info('Keeping existing .env file.')
    } else {
      writeEnvFile(envPath, databaseUrl)
    }
  } else {
    writeEnvFile(envPath, databaseUrl)
  }

  // Update .env.test if test DB was created
  if (testDatabaseUrl) {
    const envTestPath = `${ROOT}.env.test`
    const envTestContent = [
      '# Test environment configuration',
      '# Generated by pnpm setup',
      '',
      '# CRITICAL: Use a separate test database to prevent wiping production data',
      `DATABASE_URL="${testDatabaseUrl}"`,
      '',
      '# Auth secret for tests',
      `AUTH_SECRET="${generateAuthSecret()}"`,
      'AUTH_TRUST_HOST=true',
      '',
      '# Disable debug logging in tests',
      'NEXT_PUBLIC_DEBUG=false',
      '',
    ].join('\n')

    writeFileSync(envTestPath, envTestContent, 'utf-8')
    success('Wrote .env.test with test database URL.')
  }

  // ----------------------------------------------------------
  // Step 4: Install dependencies
  // ----------------------------------------------------------
  stepHeader(4, TOTAL_STEPS, 'Install Dependencies')

  const nodeModulesExist = existsSync(`${ROOT}node_modules`)
  if (nodeModulesExist) {
    info('node_modules already exists.')
    const reinstall = await prompt.askYesNo('Re-install dependencies?', false)
    if (reinstall) {
      run('pnpm install', { cwd: ROOT })
      success('Dependencies installed.')
    } else {
      info('Skipping dependency installation.')
    }
  } else {
    info('Installing dependencies...')
    const ok = run('pnpm install', { cwd: ROOT })
    if (ok) {
      success('Dependencies installed.')
    } else {
      fail('Failed to install dependencies. Please run "pnpm install" manually.')
    }
  }

  // ----------------------------------------------------------
  // Step 5: Prisma setup
  // ----------------------------------------------------------
  stepHeader(5, TOTAL_STEPS, 'Database Schema Setup')

  info('Generating Prisma client...')
  const genOk = run('pnpm db:generate', { cwd: ROOT })
  if (genOk) {
    success('Prisma client generated.')
  } else {
    fail('Failed to generate Prisma client.')
    info('You can retry manually: pnpm db:generate')
  }

  info('Pushing schema to database...')
  const pushOk = run('pnpm db:push', { cwd: ROOT })
  if (pushOk) {
    success('Database schema pushed.')
  } else {
    fail('Failed to push schema to database.')
    info('Check your DATABASE_URL in .env and ensure PostgreSQL is running.')
    info('You can retry manually: pnpm db:push')
  }

  // ----------------------------------------------------------
  // Step 6: Create admin user
  // ----------------------------------------------------------
  stepHeader(6, TOTAL_STEPS, 'Create Admin User')

  const wantAdmin = await prompt.askYesNo('Create an admin user now?', true)

  if (wantAdmin) {
    await createAdminUser(prompt)
  } else {
    info('Skipping admin user creation.')
    info('You can create one later: pnpm db:seed --username <user> --password <pass> --name <name>')
  }

  // ----------------------------------------------------------
  // Done
  // ----------------------------------------------------------
  printCompletionBanner()
  prompt.close()
}

async function setupDemoMode(prompt: ReturnType<typeof createPrompter>) {
  stepHeader(1, 3, 'Demo Mode Configuration')

  const envPath = `${ROOT}.env`
  const authSecret = generateAuthSecret()

  const envContent = [
    '# PUNT Environment Configuration',
    '# Generated by pnpm setup (demo mode)',
    '',
    '# Demo mode - all data stored in browser localStorage',
    'NEXT_PUBLIC_DEMO_MODE=true',
    '',
    '# Placeholder DATABASE_URL (not used in demo mode, but required by Prisma client generation)',
    'DATABASE_URL="postgresql://unused:unused@localhost:5432/unused"',
    '',
    `AUTH_SECRET="${authSecret}"`,
    'AUTH_TRUST_HOST=true',
    '',
    'NEXT_PUBLIC_DEBUG=false',
    '',
  ].join('\n')

  const envExists = existsSync(envPath)
  if (envExists) {
    warn('.env file already exists.')
    const overwrite = await prompt.askYesNo('Overwrite existing .env file?', false)
    if (!overwrite) {
      info('Keeping existing .env file.')
    } else {
      writeFileSync(envPath, envContent, 'utf-8')
      success('Wrote .env for demo mode.')
    }
  } else {
    writeFileSync(envPath, envContent, 'utf-8')
    success('Wrote .env for demo mode.')
  }

  stepHeader(2, 3, 'Install Dependencies')

  const nodeModulesExist = existsSync(`${ROOT}node_modules`)
  if (nodeModulesExist) {
    info('node_modules already exists.')
    const reinstall = await prompt.askYesNo('Re-install dependencies?', false)
    if (reinstall) {
      run('pnpm install', { cwd: ROOT })
    } else {
      info('Skipping dependency installation.')
    }
  } else {
    info('Installing dependencies...')
    run('pnpm install', { cwd: ROOT })
  }
  success('Dependencies ready.')

  stepHeader(3, 3, 'Generate Prisma Client')
  info('Generating Prisma client (needed even in demo mode for type definitions)...')
  const genOk = run('pnpm db:generate', { cwd: ROOT })
  if (genOk) {
    success('Prisma client generated.')
  } else {
    fail('Failed to generate Prisma client.')
    info('You can retry manually: pnpm db:generate')
  }

  console.log('')
  console.log(fmt.success('  ========================================'))
  console.log(fmt.success('       Demo Mode Setup Complete!'))
  console.log(fmt.success('  ========================================'))
  console.log('')
  info(`Start the dev server:  ${fmt.bold('pnpm dev')}`)
  info(`Then open:             ${fmt.bold('http://localhost:3000')}`)
  console.log('')
  info("Demo mode stores all data in your browser's localStorage.")
  info('No database connection is needed.')
  console.log('')
}

async function createAdminUser(prompt: ReturnType<typeof createPrompter>) {
  // Collect username
  let username = ''
  while (true) {
    username = await prompt.ask('Admin username (3-30 chars, alphanumeric/-/_):')
    if (!username) {
      warn('Username is required.')
      continue
    }
    const validation = validateUsername(username)
    if (!validation.valid) {
      warn(validation.error ?? 'Invalid username.')
      continue
    }
    break
  }

  // Collect display name
  let displayName = ''
  while (true) {
    displayName = await prompt.ask('Display name:', username)
    if (!displayName) {
      warn('Display name is required.')
      continue
    }
    break
  }

  // Collect email (optional)
  let email: string | null = null
  const emailInput = await prompt.ask('Email (optional, press Enter to skip):')
  if (emailInput) {
    if (!validateEmail(emailInput)) {
      warn('Invalid email format. Skipping email.')
    } else {
      email = emailInput
    }
  }

  // Collect password
  let password = ''
  while (true) {
    password = await prompt.askPassword('Password (min 12 chars, 1 upper, 1 lower, 1 number):')
    if (!password) {
      warn('Password is required.')
      continue
    }
    const validation = validatePasswordStrength(password)
    if (!validation.valid) {
      for (const err of validation.errors) {
        warn(err)
      }
      continue
    }

    const confirm = await prompt.askPassword('Confirm password:')
    if (password !== confirm) {
      warn('Passwords do not match. Try again.')
      continue
    }
    break
  }

  // Hash password and create user via Prisma
  info('Creating admin user...')

  try {
    const bcrypt = await import('bcryptjs')
    const { PrismaClient } = await import('../src/generated/prisma')
    const prisma = new PrismaClient()

    try {
      // Check if username already exists
      const existingUser = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      })

      if (existingUser) {
        warn(`Username "${username}" already exists.`)
        info('You can log in with this username at http://localhost:3000/login')
        await prisma.$disconnect()
        return
      }

      // Check if email already exists
      if (email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email },
        })
        if (existingEmail) {
          warn(`Email "${email}" is already in use. Creating user without email.`)
          email = null
        }
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const user = await prisma.user.create({
        data: {
          username,
          name: displayName,
          email,
          passwordHash,
          isSystemAdmin: true,
          isActive: true,
        },
      })

      success('Admin user created successfully!')
      console.log('')
      console.log(`    Username: ${fmt.bold(user.username)}`)
      console.log(`    Name:     ${user.name}`)
      if (user.email) {
        console.log(`    Email:    ${user.email}`)
      }
      console.log(`    Role:     ${fmt.green('System Administrator')}`)
      console.log('')
    } finally {
      await prisma.$disconnect()
    }
  } catch (err) {
    fail('Failed to create admin user.')
    if (err instanceof Error) {
      console.log(`    ${fmt.dim(err.message)}`)
    }
    console.log('')
    info('You can create an admin user later:')
    console.log(
      fmt.dim(
        `    pnpm db:seed --username ${username} --password <password> --name "${displayName}"`,
      ),
    )
  }
}

function writeEnvFile(envPath: string, databaseUrl: string) {
  const authSecret = generateAuthSecret()
  const envContent = buildEnvFile({
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: authSecret,
  })

  writeFileSync(envPath, envContent, 'utf-8')
  success('Wrote .env file.')
  info(`AUTH_SECRET generated: ${fmt.dim(`${authSecret.substring(0, 8)}...`)}`)
}

function printCompletionBanner() {
  console.log('')
  console.log(fmt.success('  ========================================'))
  console.log(fmt.success('         Setup Complete!'))
  console.log(fmt.success('  ========================================'))
  console.log('')
  info(`Start the dev server:  ${fmt.bold('pnpm dev')}`)
  info(`Then open:             ${fmt.bold('http://localhost:3000')}`)
  console.log('')
  info('Useful commands:')
  console.log(`    ${fmt.dim('pnpm dev')}             Start dev server`)
  console.log(`    ${fmt.dim('pnpm db:studio')}       Visual database browser`)
  console.log(`    ${fmt.dim('pnpm test')}            Run tests`)
  console.log(`    ${fmt.dim('pnpm lint')}            Check for lint issues`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('')
  fail(`Setup failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
