/**
 * Migration script: Convert clones/is_cloned_by links to duplicates/is_duplicated_by
 *
 * This script converts any existing ticket links using the removed
 * `clones` and `is_cloned_by` link types to their equivalent
 * `duplicates` and `is_duplicated_by` types.
 *
 * Run with: npx tsx prisma/migrate-clone-links.ts
 */
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Convert clones -> duplicates
  // Note: 'clones' is a legacy link type not in the PostgreSQL enum,
  // so we use raw SQL to find and update these records
  const clonesResult = await prisma.$executeRawUnsafe(
    `UPDATE "TicketLink" SET "linkType" = 'duplicates' WHERE "linkType" = 'clones'`,
  )
  console.log(`Converted ${clonesResult} 'clones' links to 'duplicates'`)

  // Convert is_cloned_by -> is_duplicated_by
  const isClonedByResult = await prisma.$executeRawUnsafe(
    `UPDATE "TicketLink" SET "linkType" = 'is_duplicated_by' WHERE "linkType" = 'is_cloned_by'`,
  )
  console.log(`Converted ${isClonedByResult} 'is_cloned_by' links to 'is_duplicated_by'`)

  console.log('Migration complete.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
