'use client'

import { useProjectsStore } from '@/stores/projects-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

export function formatTicketId(ticket: TicketWithRelations): string {
  const project = useProjectsStore.getState().getProject(ticket.projectId)
  const projectKey = project?.key || 'TICKET'

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
