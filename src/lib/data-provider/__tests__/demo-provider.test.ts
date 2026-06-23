import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { DEMO_USER_SUMMARY } from '@/lib/demo/demo-data'
import { demoStorage } from '@/lib/demo/demo-storage'
import { DemoDataProvider } from '../demo-provider'

vi.mock('@/lib/demo/demo-storage', () => ({
  demoStorage: {
    initialize: vi.fn(),
    getProjects: vi.fn(() => []),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getColumnsWithTickets: vi.fn(() => []),
    getColumns: vi.fn(() => []),
    getTickets: vi.fn(() => []),
    getTicket: vi.fn(),
    createTicket: vi.fn((_pid, _col, data) => data),
    updateTicket: vi.fn(),
    deleteTicket: vi.fn(),
    getLabels: vi.fn(() => []),
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    getSprints: vi.fn(() => []),
    getActiveSprint: vi.fn(),
    createSprint: vi.fn(),
    updateSprint: vi.fn(),
    deleteSprint: vi.fn(),
  },
}))

const store = vi.mocked(demoStorage)

beforeEach(() => {
  vi.clearAllMocks()
  // re-apply default return values cleared by clearAllMocks
  store.getProjects.mockReturnValue([])
  store.getColumns.mockReturnValue([])
  store.getColumnsWithTickets.mockReturnValue([])
  store.getTickets.mockReturnValue([])
  store.getLabels.mockReturnValue([])
  store.getSprints.mockReturnValue([])
  store.createTicket.mockImplementation((_pid, _col, data) => data as never)
})

describe('DemoDataProvider construction', () => {
  it('initializes demo storage', () => {
    new DemoDataProvider()
    expect(store.initialize).toHaveBeenCalled()
  })
})

describe('getProject', () => {
  it('returns the project with an owner role when found', async () => {
    store.getProject.mockReturnValue({ id: 'p1', name: 'P' } as never)
    const result = await new DemoDataProvider().getProject('p1')
    expect(result).toMatchObject({ id: 'p1', role: 'owner' })
  })

  it('returns null when the project is missing', async () => {
    store.getProject.mockReturnValue(undefined as never)
    expect(await new DemoDataProvider().getProject('p1')).toBeNull()
  })
})

describe('not-found errors', () => {
  it('updateProject throws when storage returns nothing', async () => {
    store.updateProject.mockReturnValue(undefined as never)
    await expect(new DemoDataProvider().updateProject('p1', {} as never)).rejects.toThrow(
      'Project not found',
    )
  })

  it('updateTicket throws when storage returns nothing', async () => {
    store.updateTicket.mockReturnValue(undefined as never)
    await expect(new DemoDataProvider().updateTicket('p1', 't1', {} as never)).rejects.toThrow(
      'Ticket not found',
    )
  })

  it('updateLabel throws when storage returns nothing', async () => {
    store.updateLabel.mockReturnValue(undefined as never)
    await expect(new DemoDataProvider().updateLabel('p1', 'l1', {} as never)).rejects.toThrow(
      'Label not found',
    )
  })

  it('updateSprint throws when storage returns nothing', async () => {
    store.updateSprint.mockReturnValue(undefined as never)
    await expect(new DemoDataProvider().updateSprint('p1', 's1', {} as never)).rejects.toThrow(
      'Sprint not found',
    )
  })
})

describe('searchTickets', () => {
  const provider = () => new DemoDataProvider()

  it('returns an empty array for a blank query', async () => {
    expect(await provider().searchTickets('p1', { query: '   ' })).toEqual([])
  })

  it('matches by title (case-insensitive)', async () => {
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', title: 'Fix the Login bug', number: 1 }),
      createMockTicket({ id: 't2', title: 'Unrelated', number: 2 }),
    ])
    const result = await provider().searchTickets('p1', { query: 'login' })
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('matches by description', async () => {
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', title: 'A', description: 'mentions widget', number: 1 }),
    ])
    const result = await provider().searchTickets('p1', { query: 'widget' })
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('matches a bare ticket number (requires the project to resolve the key)', async () => {
    store.getProjects.mockReturnValue([{ id: 'p1', key: 'PUNT' }] as never)
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', title: 'A', number: 42 }),
      createMockTicket({ id: 't2', title: 'B', number: 7 }),
    ])
    const result = await provider().searchTickets('p1', { query: '42' })
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('matches a PROJECT-N key pattern', async () => {
    store.getProjects.mockReturnValue([{ id: 'p1', key: 'PUNT' }] as never)
    store.getTickets.mockReturnValue([createMockTicket({ id: 't1', title: 'A', number: 99 })])
    const result = await provider().searchTickets('p1', { query: 'PUNT-99' })
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('respects the limit', async () => {
    store.getTickets.mockReturnValue(
      Array.from({ length: 5 }, (_, i) =>
        createMockTicket({ id: `t${i}`, title: `match ${i}`, number: i }),
      ),
    )
    const result = await provider().searchTickets('p1', { query: 'match', limit: 2 })
    expect(result).toHaveLength(2)
  })
})

describe('createTicket resolves relations', () => {
  it('resolves labels, sprint, and assignee from ids and defaults the creator', async () => {
    store.getLabels.mockReturnValue([
      { id: 'l1', name: 'bug', color: '#f00' },
      { id: 'l2', name: 'ui', color: '#0f0' },
    ] as never)
    store.getSprints.mockReturnValue([{ id: 's1', name: 'S1' }] as never)

    await new DemoDataProvider().createTicket('p1', {
      columnId: 'c1',
      title: 'T',
      labelIds: ['l1'],
      sprintId: 's1',
      assigneeId: DEMO_USER_SUMMARY.id,
    } as never)

    const passed = store.createTicket.mock.calls[0][2] as Record<string, unknown>
    expect((passed.labels as Array<{ id: string }>).map((l) => l.id)).toEqual(['l1'])
    expect((passed.sprint as { id: string }).id).toBe('s1')
    expect((passed.assignee as { id: string }).id).toBe(DEMO_USER_SUMMARY.id)
    expect((passed.creator as { id: string }).id).toBe(DEMO_USER_SUMMARY.id)
  })
})

describe('updateTicket maps inputs', () => {
  beforeEach(() => {
    store.updateTicket.mockImplementation(
      (_p, _t, updates) => ({ ...createMockTicket({ id: 't1' }), ...updates }) as never,
    )
  })

  it('converts resolvedAt strings to Date and clears with null', async () => {
    await new DemoDataProvider().updateTicket('p1', 't1', { resolvedAt: '2024-05-01' } as never)
    expect((store.updateTicket.mock.calls[0][2] as { resolvedAt: Date }).resolvedAt).toBeInstanceOf(
      Date,
    )

    store.updateTicket.mockClear()
    await new DemoDataProvider().updateTicket('p1', 't1', { resolvedAt: null } as never)
    expect((store.updateTicket.mock.calls[0][2] as { resolvedAt: null }).resolvedAt).toBeNull()
  })

  it('clears sprint when sprintId is null', async () => {
    await new DemoDataProvider().updateTicket('p1', 't1', { sprintId: null } as never)
    expect((store.updateTicket.mock.calls[0][2] as { sprint: null }).sprint).toBeNull()
  })
})

describe('moveTickets', () => {
  it('updates each ticket order and collects the successful results', async () => {
    store.updateTicket.mockImplementation((_p, id) =>
      id === 'missing' ? (undefined as never) : (createMockTicket({ id }) as never),
    )
    const result = await new DemoDataProvider().moveTickets('p1', ['a', 'missing', 'b'], 'c2', 0)
    expect(result.map((t) => t.id)).toEqual(['a', 'b'])
    expect(store.updateTicket).toHaveBeenCalledTimes(3)
  })
})

describe('completeSprint', () => {
  beforeEach(() => {
    store.getSprints.mockReturnValue([{ id: 's1', name: 'S1', status: 'active' }] as never)
    store.updateSprint.mockReturnValue({ id: 's1', status: 'completed' } as never)
  })

  it('throws when the sprint does not exist', async () => {
    store.getSprints.mockReturnValue([])
    await expect(
      new DemoDataProvider().completeSprint('p1', 's1', { incompleteAction: 'keep' }),
    ).rejects.toThrow('Sprint not found')
  })

  it('moves incomplete tickets to the backlog and reports disposition', async () => {
    store.getColumns.mockReturnValue([{ id: 'c1', name: 'To Do' }] as never)
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', sprintId: 's1', columnId: 'c1' }),
    ])

    const result = (await new DemoDataProvider().completeSprint('p1', 's1', {
      incompleteAction: 'backlog',
    })) as unknown as { ticketDisposition: { movedToBacklog: string[] } }

    expect(result.ticketDisposition.movedToBacklog).toEqual(['t1'])
    expect(store.updateTicket).toHaveBeenCalledWith(
      'p1',
      't1',
      expect.objectContaining({ sprintId: null }),
    )
  })

  it('counts tickets in a Done column as completed', async () => {
    store.getColumns.mockReturnValue([{ id: 'c-done', name: 'Done' }] as never)
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', sprintId: 's1', columnId: 'c-done' }),
    ])

    const result = (await new DemoDataProvider().completeSprint('p1', 's1', {
      incompleteAction: 'backlog',
    })) as unknown as { ticketDisposition: { completed: string[] } }

    expect(result.ticketDisposition.completed).toEqual(['t1'])
  })

  it('carries incomplete tickets over to the target sprint', async () => {
    store.getSprints.mockReturnValue([
      { id: 's1', name: 'S1', status: 'active' },
      { id: 's2', name: 'S2', status: 'planning' },
    ] as never)
    store.getColumns.mockReturnValue([{ id: 'c1', name: 'In Progress' }] as never)
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', sprintId: 's1', columnId: 'c1', carriedOverCount: 0 }),
    ])

    const result = (await new DemoDataProvider().completeSprint('p1', 's1', {
      incompleteAction: 'carryover',
      carryOverToSprintId: 's2',
    })) as unknown as { ticketDisposition: { carriedOver: string[] } }

    expect(result.ticketDisposition.carriedOver).toEqual(['t1'])
    expect(store.updateTicket).toHaveBeenCalledWith(
      'p1',
      't1',
      expect.objectContaining({ sprintId: 's2', isCarriedOver: true, carriedFromSprintId: 's1' }),
    )
  })
})

describe('reopenSprint', () => {
  it('throws when the sprint is not completed', async () => {
    store.getSprints.mockReturnValue([{ id: 's1', status: 'active' }] as never)
    await expect(new DemoDataProvider().reopenSprint('p1', 's1')).rejects.toThrow(
      'Can only reopen a completed sprint',
    )
  })

  it('throws when another sprint is already active', async () => {
    store.getSprints.mockReturnValue([{ id: 's1', status: 'completed' }] as never)
    store.getActiveSprint.mockReturnValue({ id: 's2', name: 'Other' } as never)
    await expect(new DemoDataProvider().reopenSprint('p1', 's1')).rejects.toThrow(/already active/)
  })

  it('reactivates a completed sprint when nothing else is active', async () => {
    store.getSprints.mockReturnValue([{ id: 's1', status: 'completed' }] as never)
    store.getActiveSprint.mockReturnValue(undefined as never)
    store.updateSprint.mockReturnValue({ id: 's1', status: 'active' } as never)
    const result = await new DemoDataProvider().reopenSprint('p1', 's1')
    expect(result.status).toBe('active')
  })
})

describe('startSprint', () => {
  it('defaults the end date to two weeks after the start', async () => {
    store.getSprints.mockReturnValue([{ id: 's1', status: 'planning' }] as never)
    store.updateSprint.mockImplementation((_p, _s, data) => ({ id: 's1', ...data }) as never)

    const start = new Date('2024-01-01T00:00:00Z')
    await new DemoDataProvider().startSprint('p1', 's1', { startDate: start } as never)
    const passed = store.updateSprint.mock.calls[0][2] as { startDate: Date; endDate: Date }
    const days = (passed.endDate.getTime() - passed.startDate.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBe(14)
  })

  it('throws when the sprint does not exist', async () => {
    store.getSprints.mockReturnValue([])
    await expect(new DemoDataProvider().startSprint('p1', 's1', {} as never)).rejects.toThrow(
      'Sprint not found',
    )
  })
})

describe('getDashboardStats', () => {
  it('categorizes tickets by column name', async () => {
    store.getProjects.mockReturnValue([{ id: 'p1' }] as never)
    store.getColumns.mockReturnValue([
      { id: 'c1', name: 'To Do' },
      { id: 'c2', name: 'In Progress' },
      { id: 'c3', name: 'Done' },
    ] as never)
    store.getTickets.mockReturnValue([
      createMockTicket({ id: 't1', columnId: 'c1' }),
      createMockTicket({ id: 't2', columnId: 'c2' }),
      createMockTicket({ id: 't3', columnId: 'c3' }),
      createMockTicket({ id: 't4', columnId: 'c3' }),
    ])

    const stats = await new DemoDataProvider().getDashboardStats()
    expect(stats).toEqual({ openTickets: 1, inProgress: 1, completed: 2 })
  })
})

describe('static demo-mode responses', () => {
  it('getSprintSettings returns demo defaults', async () => {
    const s = await new DemoDataProvider().getSprintSettings('p1')
    expect(s.defaultSprintDuration).toBe(14)
  })

  it('updateSprintSettings merges provided values', async () => {
    const s = await new DemoDataProvider().updateSprintSettings('p1', {
      defaultSprintDuration: 7,
      doneColumnIds: ['c1'],
    })
    expect(s.defaultSprintDuration).toBe(7)
    expect(s.doneColumnIds).toEqual(['c1'])
  })

  it('getProjectMembers includes the demo user', async () => {
    const members = await new DemoDataProvider().getProjectMembers('p1')
    expect(members.some((m) => m.id === DEMO_USER_SUMMARY.id)).toBe(true)
  })

  it('getBranding returns the PUNT defaults', async () => {
    expect((await new DemoDataProvider().getBranding()).appName).toBe('PUNT')
  })

  it('getBurndownData returns an empty points series', async () => {
    const d = await new DemoDataProvider().getBurndownData('p1', 's1')
    expect(d.unit).toBe('points')
    expect(d.dataPoints).toEqual([])
  })
})

describe('delegations to demoStorage', () => {
  it('passes through simple reads and writes', async () => {
    const p = new DemoDataProvider()
    await p.getProjects()
    await p.createProject({ name: 'X' } as never)
    await p.deleteProject('p1')
    await p.getColumnsWithTickets('p1')
    await p.getTickets('p1')
    await p.getTicket('p1', 't1')
    await p.deleteTicket('p1', 't1')
    await p.getLabels('p1')
    await p.createLabel('p1', { name: 'L', color: '#fff' } as never)
    await p.deleteLabel('p1', 'l1')
    await p.getSprints('p1')
    await p.getActiveSprint('p1')
    await p.createSprint('p1', { name: 'S' } as never)
    await p.deleteSprint('p1', 's1')

    expect(store.getProjects).toHaveBeenCalled()
    expect(store.createProject).toHaveBeenCalledWith({ name: 'X' })
    expect(store.deleteProject).toHaveBeenCalledWith('p1')
    expect(store.getColumnsWithTickets).toHaveBeenCalledWith('p1')
    expect(store.deleteTicket).toHaveBeenCalledWith('p1', 't1')
    expect(store.createLabel).toHaveBeenCalledWith('p1', { name: 'L', color: '#fff' })
    expect(store.deleteSprint).toHaveBeenCalledWith('p1', 's1')
  })
})
