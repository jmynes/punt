/**
 * Backfill agent snapshot fields for existing tickets
 *
 * This script populates createdByAgentIdSnapshot, createdByAgentName, and
 * createdByAgentOwnerName for tickets that have a createdByAgentId but
 * missing snapshot fields.
 *
 * Usage: pnpm tsx prisma/backfill-agent-snapshots.ts
 */

import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting agent snapshot backfill...\n')

  // Find all tickets with a createdByAgentId but missing snapshot fields
  const ticketsToUpdate = await prisma.ticket.findMany({
    where: {
      createdByAgentId: { not: null },
      OR: [
        { createdByAgentIdSnapshot: null },
        { createdByAgentName: null },
        { createdByAgentOwnerName: null },
      ],
    },
    select: {
      id: true,
      number: true,
      createdByAgentId: true,
      createdByAgentIdSnapshot: true,
      createdByAgentName: true,
      createdByAgentOwnerName: true,
      project: { select: { key: true } },
      createdByAgent: {
        select: {
          name: true,
          owner: { select: { name: true } },
        },
      },
    },
  })

  if (ticketsToUpdate.length === 0) {
    console.log('No tickets need backfilling.')
    return
  }

  console.log(`Found ${ticketsToUpdate.length} ticket(s) to backfill.\n`)

  let updated = 0

  for (const ticket of ticketsToUpdate) {
    const ticketKey = `${ticket.project.key}-${ticket.number}`

    // Always backfill the ID snapshot from createdByAgentId (preserved even if agent deleted)
    const idSnapshot = ticket.createdByAgentId

    if (!ticket.createdByAgent) {
      // Agent no longer exists - can only backfill the ID snapshot
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          createdByAgentIdSnapshot: idSnapshot,
        },
      })
      console.log(
        `  ${ticketKey}: Set idSnapshot="${idSnapshot}" (agent deleted, name not available)`,
      )
      updated++
      continue
    }

    const agentName = ticket.createdByAgent.name
    const ownerName = ticket.createdByAgent.owner.name ?? 'Unknown'

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        createdByAgentIdSnapshot: idSnapshot,
        createdByAgentName: agentName,
        createdByAgentOwnerName: ownerName,
      },
    })

    console.log(
      `  ${ticketKey}: Set idSnapshot="${idSnapshot}", agentName="${agentName}", ownerName="${ownerName}"`,
    )
    updated++
  }

  console.log(`\nBackfill complete: ${updated} ticket(s) updated`)
}

main()
  .catch((error) => {
    console.error('Error running backfill:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
