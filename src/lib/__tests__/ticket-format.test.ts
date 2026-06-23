import { beforeEach, describe, expect, it } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { useProjectsStore } from '@/stores/projects-store'
import type { ColumnWithTickets } from '@/types'
import { formatTicketId, formatTicketIds } from '../ticket-format'

beforeEach(() => {
  useProjectsStore.setState({
    projects: [{ id: 'p1', key: 'PUNT', name: 'Punt', color: '#000', role: 'owner' }],
  })
})

describe('formatTicketId', () => {
  it('formats as PROJECTKEY-NUMBER when the project is known', () => {
    const ticket = createMockTicket({ id: 't1', projectId: 'p1', number: 42 })
    expect(formatTicketId(ticket)).toBe('PUNT-42')
  })

  it('falls back to TICKET when the project is unknown', () => {
    const ticket = createMockTicket({ id: 't1', projectId: 'unknown', number: 7 })
    expect(formatTicketId(ticket)).toBe('TICKET-7')
  })
})

describe('formatTicketIds', () => {
  it('maps known ids to formatted keys and leaves unknown ids as-is', () => {
    const t1 = createMockTicket({ id: 't1', projectId: 'p1', number: 1 })
    const t2 = createMockTicket({ id: 't2', projectId: 'p1', number: 2 })
    const columns: ColumnWithTickets[] = [
      { id: 'c1', name: 'To Do', order: 0, projectId: 'p1', tickets: [t1, t2] },
    ]
    expect(formatTicketIds(columns, ['t1', 't2', 'missing'])).toEqual([
      'PUNT-1',
      'PUNT-2',
      'missing',
    ])
  })
})
