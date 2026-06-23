import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIDataProvider } from '../api-provider'

// withBasePath is kept real (NEXT_PUBLIC_BASE_PATH is empty in tests, so it
// returns the path unchanged). Only the network boundary is mocked.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  // mockImplementation (not mockResolvedValue) so every call gets a FRESH
  // Response — a Response body can only be read once.
  fetchMock = vi.fn().mockImplementation(async () => jsonResponse({}))
  vi.stubGlobal('fetch', fetchMock)
})

function lastCall(): [string, RequestInit] {
  const calls = fetchMock.mock.calls
  return calls[calls.length - 1] as [string, RequestInit]
}

describe('APIDataProvider.fetchJson (via getProjects)', () => {
  it('sends a JSON Content-Type header', async () => {
    await new APIDataProvider().getProjects()
    const [, init] = lastCall()
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('includes the X-Tab-Id header when a tabId is set', async () => {
    await new APIDataProvider('tab-9').getProjects()
    const [, init] = lastCall()
    expect((init.headers as Record<string, string>)['X-Tab-Id']).toBe('tab-9')
  })

  it('omits X-Tab-Id when no tabId is provided', async () => {
    await new APIDataProvider().getProjects()
    const [, init] = lastCall()
    expect((init.headers as Record<string, string>)['X-Tab-Id']).toBeUndefined()
  })

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'p1' }]))
    const result = await new APIDataProvider().getProjects()
    expect(result).toEqual([{ id: 'p1' }])
  })

  it('throws the server-provided error message on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Nope' }, 400))
    await expect(new APIDataProvider().getProjects()).rejects.toThrow('Nope')
  })

  it('falls back to "Request failed" when the error body is not JSON', async () => {
    fetchMock.mockImplementation(async () => new Response('boom', { status: 503 }))
    await expect(new APIDataProvider().getProjects()).rejects.toThrow('Request failed')
  })

  it('throws an HTTP <status> error when the error body has no error field', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, 503))
    await expect(new APIDataProvider().getProjects()).rejects.toThrow('HTTP 503')
  })
})

describe('APIDataProvider error-swallowing reads', () => {
  it('getProject returns null when the request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, 404))
    expect(await new APIDataProvider().getProject('p1')).toBeNull()
  })

  it('getTicket returns null when the request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, 404))
    expect(await new APIDataProvider().getTicket('p1', 't1')).toBeNull()
  })

  it('getActiveSprint returns null when the request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, 404))
    expect(await new APIDataProvider().getActiveSprint('p1')).toBeNull()
  })
})

describe('APIDataProvider special-logic methods', () => {
  it('searchTickets builds query params with q and limit', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await new APIDataProvider().searchTickets('p1', { query: 'bug', limit: 25 })
    const [url] = lastCall()
    expect(url).toContain('/api/projects/p1/tickets/search?')
    expect(url).toContain('q=bug')
    expect(url).toContain('limit=25')
  })

  it('searchTickets omits limit when not provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await new APIDataProvider().searchTickets('p1', { query: 'bug' })
    const [url] = lastCall()
    expect(url).toContain('q=bug')
    expect(url).not.toContain('limit=')
  })

  it('completeSprint maps the incomplete action and passes the carryover target', async () => {
    await new APIDataProvider().completeSprint('p1', 's1', {
      incompleteAction: 'carryover',
      carryOverToSprintId: 's2',
    })
    const [url, init] = lastCall()
    expect(url).toContain('/api/projects/p1/sprints/s1/complete')
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'close_to_next',
      targetSprintId: 's2',
    })
  })

  it('completeSprint falls back to close_to_backlog for an unknown action', async () => {
    await new APIDataProvider().completeSprint('p1', 's1', {
      incompleteAction: 'bogus' as never,
    })
    const [, init] = lastCall()
    expect(JSON.parse(init.body as string).action).toBe('close_to_backlog')
  })

  it('getBurndownData appends ?unit=tickets only for the tickets unit', async () => {
    const p = new APIDataProvider()
    await p.getBurndownData('p1', 's1', 'tickets')
    expect(lastCall()[0]).toContain('?unit=tickets')
    await p.getBurndownData('p1', 's1', 'points')
    expect(lastCall()[0]).not.toContain('unit=')
  })

  it('getProjectMembers unwraps the user from each membership row', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ user: { id: 'u1' } }, { user: { id: 'u2' } }]))
    const members = await new APIDataProvider().getProjectMembers('p1')
    expect(members).toEqual([{ id: 'u1' }, { id: 'u2' }])
  })

  it('deleteProject sends the reauth payload when provided', async () => {
    await new APIDataProvider().deleteProject('p1', { confirmPassword: 'pw' })
    const [, init] = lastCall()
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(init.body as string)).toEqual({ confirmPassword: 'pw' })
  })

  it('deleteProject omits a body when no reauth is provided', async () => {
    await new APIDataProvider().deleteProject('p1')
    const [, init] = lastCall()
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })

  it('moveTicket delegates to updateTicket (PATCH on the ticket)', async () => {
    await new APIDataProvider().moveTicket('p1', 't1', { columnId: 'c2', order: 3 })
    const [url, init] = lastCall()
    expect(url).toContain('/api/projects/p1/tickets/t1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ columnId: 'c2', order: 3 })
  })
})

describe('APIDataProvider URL/method/body contract', () => {
  const P = 'p1'
  type Case = {
    name: string
    run: (p: APIDataProvider) => Promise<unknown>
    url: string
    method?: string
    body?: unknown
  }
  const cases: Case[] = [
    { name: 'getProjects', run: (p) => p.getProjects(), url: '/api/projects' },
    {
      name: 'createProject',
      run: (p) => p.createProject({ name: 'X', key: 'X' } as never),
      url: '/api/projects',
      method: 'POST',
      body: { name: 'X', key: 'X' },
    },
    {
      name: 'updateProject',
      run: (p) => p.updateProject(P, { name: 'Y' } as never),
      url: '/api/projects/p1',
      method: 'PATCH',
      body: { name: 'Y' },
    },
    {
      name: 'getColumnsWithTickets',
      run: (p) => p.getColumnsWithTickets(P),
      url: '/api/projects/p1/columns',
    },
    { name: 'getTickets', run: (p) => p.getTickets(P), url: '/api/projects/p1/tickets' },
    {
      name: 'createTicket',
      run: (p) => p.createTicket(P, { title: 'T' } as never),
      url: '/api/projects/p1/tickets',
      method: 'POST',
      body: { title: 'T' },
    },
    {
      name: 'updateTicket',
      run: (p) => p.updateTicket(P, 't1', { title: 'T2' } as never),
      url: '/api/projects/p1/tickets/t1',
      method: 'PATCH',
      body: { title: 'T2' },
    },
    {
      name: 'deleteTicket',
      run: (p) => p.deleteTicket(P, 't1'),
      url: '/api/projects/p1/tickets/t1',
      method: 'DELETE',
    },
    {
      name: 'moveTickets',
      run: (p) => p.moveTickets(P, ['t1', 't2'], 'c2', 0),
      url: '/api/projects/p1/tickets',
      method: 'PATCH',
      body: { ticketIds: ['t1', 't2'], toColumnId: 'c2', newOrder: 0 },
    },
    { name: 'getLabels', run: (p) => p.getLabels(P), url: '/api/projects/p1/labels' },
    {
      name: 'createLabel',
      run: (p) => p.createLabel(P, { name: 'L', color: '#fff' } as never),
      url: '/api/projects/p1/labels',
      method: 'POST',
      body: { name: 'L', color: '#fff' },
    },
    {
      name: 'updateLabel',
      run: (p) => p.updateLabel(P, 'l1', { name: 'L2' } as never),
      url: '/api/projects/p1/labels/l1',
      method: 'PATCH',
      body: { name: 'L2' },
    },
    {
      name: 'deleteLabel',
      run: (p) => p.deleteLabel(P, 'l1'),
      url: '/api/projects/p1/labels/l1',
      method: 'DELETE',
    },
    { name: 'getSprints', run: (p) => p.getSprints(P), url: '/api/projects/p1/sprints' },
    {
      name: 'createSprint',
      run: (p) => p.createSprint(P, { name: 'S' } as never),
      url: '/api/projects/p1/sprints',
      method: 'POST',
      body: { name: 'S' },
    },
    {
      name: 'updateSprint',
      run: (p) => p.updateSprint(P, 's1', { name: 'S2' } as never),
      url: '/api/projects/p1/sprints/s1',
      method: 'PATCH',
      body: { name: 'S2' },
    },
    {
      name: 'deleteSprint',
      run: (p) => p.deleteSprint(P, 's1'),
      url: '/api/projects/p1/sprints/s1',
      method: 'DELETE',
    },
    {
      name: 'startSprint',
      run: (p) => p.startSprint(P, 's1', {} as never),
      url: '/api/projects/p1/sprints/s1/start',
      method: 'POST',
    },
    {
      name: 'extendSprint',
      run: (p) => p.extendSprint(P, 's1', { endDate: 'x' } as never),
      url: '/api/projects/p1/sprints/s1/extend',
      method: 'POST',
      body: { endDate: 'x' },
    },
    {
      name: 'reopenSprint',
      run: (p) => p.reopenSprint(P, 's1'),
      url: '/api/projects/p1/sprints/s1/reopen',
      method: 'POST',
      body: {},
    },
    {
      name: 'getSprintSettings',
      run: (p) => p.getSprintSettings(P),
      url: '/api/projects/p1/sprints/settings',
    },
    {
      name: 'updateSprintSettings',
      run: (p) => p.updateSprintSettings(P, { doneColumnIds: ['c1'] } as never),
      url: '/api/projects/p1/sprints/settings',
      method: 'PATCH',
      body: { doneColumnIds: ['c1'] },
    },
    { name: 'getDashboardStats', run: (p) => p.getDashboardStats(), url: '/api/dashboard/stats' },
    { name: 'getBranding', run: (p) => p.getBranding(), url: '/api/branding' },
  ]

  it.each(cases)('$name hits the right endpoint', async ({ run, url, method, body }) => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await run(new APIDataProvider())
    const [calledUrl, init] = lastCall()
    expect(calledUrl).toBe(url)
    expect(init.method ?? 'GET').toBe(method ?? 'GET')
    if (body !== undefined) {
      expect(JSON.parse(init.body as string)).toEqual(body)
    }
  })
})
