/**
 * Global test setup - runs once before all tests
 *
 * This ensures tests use an isolated test database, not the production database.
 * The test database schema is pushed fresh before tests run.
 */

import { execSync } from 'node:child_process'

export async function setup() {
  console.log('\n🧪 Setting up test database...')

  // Verify we're using the test database URL
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl?.includes('punt_test')) {
    throw new Error(
      `❌ Tests must use test database!\n` +
        `   Current DATABASE_URL: ${dbUrl}\n` +
        `   Expected: a PostgreSQL URL containing "punt_test"\n\n` +
        `   This safety check prevents accidentally wiping your production database.\n` +
        `   Ensure .env.test is loaded with DATABASE_URL pointing to the punt_test database`,
    )
  }

  // Push schema to test database (resets it if already exists)
  try {
    execSync('pnpm exec prisma db push --skip-generate --accept-data-loss', {
      stdio: 'pipe',
      env: { ...process.env },
    })
    console.log('   Applied schema to test database')
  } catch (error) {
    console.error('❌ Failed to set up test database:', error)
    throw error
  }

  console.log('✅ Test database ready\n')
}

export async function teardown() {
  console.log('\n🧹 Test run complete.\n')
}
