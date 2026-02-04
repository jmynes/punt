/**
 * Global test setup - runs once before all tests
 *
 * This ensures tests use an isolated test database, not the production database.
 * The test database is created fresh and schema is applied before tests run.
 */

import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DB_PATH = join(process.cwd(), 'prisma', 'test.db')

export async function setup() {
  console.log('\n🧪 Setting up test database...')

  // Verify we're using the test database URL
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl?.includes('test.db')) {
    throw new Error(
      `❌ Tests must use test database!\n` +
        `   Current DATABASE_URL: ${dbUrl}\n` +
        `   Expected: file:./test.db\n\n` +
        `   This safety check prevents accidentally wiping your production database.\n` +
        `   Ensure .env.test is loaded with DATABASE_URL="file:./test.db"`,
    )
  }

  // Remove existing test database for clean slate
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH)
    console.log('   Removed existing test database')
  }

  // Push schema to test database (creates it if doesn't exist)
  try {
    execSync('pnpm exec prisma db push --skip-generate --accept-data-loss', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    })
    console.log('   Applied schema to test database')
  } catch (error) {
    console.error('❌ Failed to set up test database:', error)
    throw error
  }

  console.log('✅ Test database ready\n')
}

export async function teardown() {
  // Optionally clean up test database after all tests
  // Keeping it allows inspection of test state if needed
  console.log('\n🧹 Test run complete. Test database preserved at prisma/test.db\n')
}
