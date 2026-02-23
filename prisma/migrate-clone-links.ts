/**
 * Migration script: Convert clones/is_cloned_by links to duplicates/is_duplicated_by
 *
 * This script converts any existing ticket links using the removed
 * `clones` and `is_cloned_by` link types to their equivalent
 * `duplicates` and `is_duplicated_by` types.
 *
 * Run with: DATABASE_URL="file:./prisma/dev.db" npx tsx prisma/migrate-clone-links.ts
 */
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Convert clones -> duplicates
  const clonesResult = await prisma.ticketLink.updateMany({
    where: { linkType: 'clones' },
    data: { linkType: 'duplicates' },
  })
  console.log(`Converted ${clonesResult.count} 'clones' links to 'duplicates'`)

  // Convert is_cloned_by -> is_duplicated_by
  const isClonedByResult = await prisma.ticketLink.updateMany({
    where: { linkType: 'is_cloned_by' },
    data: { linkType: 'is_duplicated_by' },
  })
  console.log(`Converted ${isClonedByResult.count} 'is_cloned_by' links to 'is_duplicated_by'`)

  console.log('Migration complete.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
