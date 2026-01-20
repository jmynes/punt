'use client'

import { useProjectsStore } from '@/stores/projects-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// Demo project key lookup (for localStorage-based demo projects)
const demoProjectKeys: Record<string, string> = {
  '1': 'PUNT',
  '2': 'API',
  '3': 'MOB',
  'project-1': 'PUNT',
  'project-2': 'API',
  'project-3': 'MOB',
}

export function formatTicketId(ticket: TicketWithRelations): string {
  // First check demo project keys
  let projectKey = demoProjectKeys[ticket.projectId]

  // If not a demo project, look up in the projects store
  if (!projectKey) {
    const project = useProjectsStore.getState().getProject(ticket.projectId)
    projectKey = project?.key || 'TICKET'
  }

  return `${projectKey}-${ticket.number ?? ''}`.trim()
}

export function formatTicketIds(columns: ColumnWithTickets[], ids: string[]): string[] {
  return ids
    .map((id) => {
      const t = columns.flatMap((c) => c.tickets).find((tk) => tk.id === id)
      return t ? formatTicketId(t) : id
    })
    .filter(Boolean)
}
