import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'

interface TicketPageProps {
  params: Promise<{
    projectId: string
    ticketKey: string
  }>
}

/**
 * Canonical ticket URL route
 * Validates ticket exists and redirects to backlog view with ticket param
 *
 * URL format: /projects/PUNT/PUNT-1
 * Redirects to: /projects/PUNT/backlog?ticket=PUNT-1
 */
export default async function TicketPage({ params }: TicketPageProps) {
  const { projectId: projectKey, ticketKey } = await params

  // Parse ticket key format: PUNT-1 → { key: 'PUNT', number: 1 }
  const match = ticketKey.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/i)
  if (!match) {
    notFound()
  }

  const [, ticketProjectKey, ticketNumberStr] = match
  const ticketNumber = Number.parseInt(ticketNumberStr, 10)

  // Validate ticket project key matches URL project key (case-insensitive)
  if (ticketProjectKey.toUpperCase() !== projectKey.toUpperCase()) {
    notFound()
  }

  // In demo mode, skip server-side validation and redirect directly
  // The client will handle ticket lookup via stores
  if (isDemoMode()) {
    redirect(`/projects/${projectKey}/backlog?ticket=${ticketKey.toUpperCase()}`)
  }

  // Look up project by key
  const project = await db.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    select: { id: true, key: true },
  })

  if (!project) {
    notFound()
  }

  // Look up ticket by project ID and number using the unique constraint
  const ticket = await db.ticket.findUnique({
    where: {
      projectId_number: {
        projectId: project.id,
        number: ticketNumber,
      },
    },
    select: { id: true },
  })

  if (!ticket) {
    notFound()
  }

  // Redirect to backlog view with ticket param (canonical format)
  redirect(`/projects/${project.key}/backlog?ticket=${project.key}-${ticketNumber}`)
}
