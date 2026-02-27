/**
 * Create PostgreSQL indexes that Prisma schema cannot express.
 *
 * Prisma does not support expression/functional indexes, so these must
 * be applied separately after `prisma db push`.
 *
 * Run with: pnpm db:indexes (or automatically via pnpm db:push)
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Case-insensitive username lookups use `mode: 'insensitive'` which
  // translates to `WHERE lower(username) = lower($1)`. The B-tree unique
  // index on `username` cannot be used for this — PostgreSQL needs a
  // functional index on the lowercased value.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_idx" ON "User" (lower(username))`,
  )
  console.log('Created index: User_username_lower_idx')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Failed to create indexes:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
