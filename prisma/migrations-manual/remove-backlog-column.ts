/**
 * Migration script to remove the "Backlog" column from existing projects.
 *
 * The board view now only shows tickets in the active sprint.
 * Tickets without a sprint are in the "Backlog" view, not a "Backlog" column.
 *
 * This script:
 * 1. Finds all "Backlog" columns
 * 2. Moves any tickets from "Backlog" column to "To Do" column
 * 3. Deletes the "Backlog" column
 * 4. Renumbers remaining columns (0, 1, 2, 3)
 *
 * Run with: npx tsx prisma/migrations-manual/remove-backlog-column.ts
 */

import { PrismaClient } from '@/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration: Remove Backlog columns...\n')

  // Find all projects with a "Backlog" column
  const backlogColumns = await prisma.column.findMany({
    where: { name: 'Backlog' },
    include: {
      project: { select: { id: true, name: true, key: true } },
    },
  })

  if (backlogColumns.length === 0) {
    console.log('No "Backlog" columns found. Migration complete.')
    return
  }

  console.log(`Found ${backlogColumns.length} project(s) with "Backlog" columns:\n`)

  for (const backlogCol of backlogColumns) {
    const projectName = `${backlogCol.project.key} (${backlogCol.project.name})`
    console.log(`Processing project: ${projectName}`)

    // Find the "To Do" column for this project
    const todoCol = await prisma.column.findFirst({
      where: {
        projectId: backlogCol.projectId,
        name: 'To Do',
      },
    })

    if (!todoCol) {
      console.log(`  ⚠ No "To Do" column found, creating one...`)
      // Create a To Do column if it doesn't exist
      await prisma.column.create({
        data: {
          name: 'To Do',
          order: 0,
          projectId: backlogCol.projectId,
        },
      })
    }

    // Count tickets in Backlog column
    const ticketCount = await prisma.ticket.count({
      where: { columnId: backlogCol.id },
    })

    if (ticketCount > 0) {
      // Get the target column (freshly fetch To Do to get correct id)
      const targetCol = await prisma.column.findFirst({
        where: {
          projectId: backlogCol.projectId,
          name: 'To Do',
        },
      })

      if (targetCol) {
        // Move tickets from Backlog to To Do
        await prisma.ticket.updateMany({
          where: { columnId: backlogCol.id },
          data: { columnId: targetCol.id },
        })
        console.log(`  ✓ Moved ${ticketCount} ticket(s) from "Backlog" to "To Do"`)
      }
    } else {
      console.log(`  ✓ No tickets in "Backlog" column`)
    }

    // Delete the Backlog column
    await prisma.column.delete({
      where: { id: backlogCol.id },
    })
    console.log(`  ✓ Deleted "Backlog" column`)

    // Renumber remaining columns to be 0, 1, 2, 3
    const remainingColumns = await prisma.column.findMany({
      where: { projectId: backlogCol.projectId },
      orderBy: { order: 'asc' },
    })

    for (let i = 0; i < remainingColumns.length; i++) {
      if (remainingColumns[i].order !== i) {
        await prisma.column.update({
          where: { id: remainingColumns[i].id },
          data: { order: i },
        })
      }
    }
    console.log(`  ✓ Renumbered columns (now ${remainingColumns.length} columns)\n`)
  }

  console.log('Migration complete!')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
