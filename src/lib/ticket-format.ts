'use client'

import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// Project key lookup used across the app (board/backlog)
const projectKeys: Record<string, string> = {
  '1': 'PUNT',
  '2': 'API',
  '3': 'MOB',
  'project-1': 'PUNT',
  'project-2': 'API',
  'project-3': 'MOB',
}

export function formatTicketId(ticket: TicketWithRelations): string {
  const projectKey = projectKeys[ticket.projectId] || ticket.projectId || 'TICKET'
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
