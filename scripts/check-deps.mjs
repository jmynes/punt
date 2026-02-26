import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

const yellow = (msg) => `\x1b[33m${msg}\x1b[0m`
const green = (msg) => `\x1b[32m${msg}\x1b[0m`
const bold = (msg) => `\x1b[1m${msg}\x1b[0m`

function run(cmd) {
  console.log(bold(`  -> Running: ${cmd}`))
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
  } catch {
    console.log(yellow('  -> Command failed, but continuing...'))
  }
}

function mtime(filePath) {
  try {
    return statSync(filePath).mtimeMs
  } catch {
    return 0
  }
}

try {
  let acted = false
  const nodeModules = join(ROOT, 'node_modules')
  const pnpmMarker = join(ROOT, 'node_modules', '.modules.yaml')
  const lockfile = join(ROOT, 'pnpm-lock.yaml')
  const prismaSchema = join(ROOT, 'prisma', 'schema.prisma')
  const prismaGenerated = join(ROOT, 'src', 'generated', 'prisma', 'index.js')

  if (!existsSync(nodeModules)) {
    console.log(yellow('[check-deps] node_modules not found. Installing dependencies...'))
    run('pnpm install')
    acted = true
  } else if (mtime(lockfile) > mtime(pnpmMarker)) {
    console.log(
      yellow('[check-deps] pnpm-lock.yaml is newer than node_modules. Installing dependencies...'),
    )
    run('pnpm install')
    acted = true
  }

  if (mtime(prismaSchema) > mtime(prismaGenerated)) {
    console.log(
      yellow('[check-deps] Prisma schema is newer than generated client. Regenerating...'),
    )
    run('pnpm db:generate')
    acted = true
  }

  if (!acted) {
    console.log(green('[check-deps] Dependencies and Prisma client are up to date.'))
  }
} catch (e) {
  console.log(yellow(`[check-deps] Check failed (${e.message}), continuing...`))
}
