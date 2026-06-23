import { beforeEach, describe, expect, it } from 'vitest'
import { demoStorage } from '../demo-storage'

// The shared test setup replaces global.localStorage with a non-persisting
// vi.fn() stub. demoStorage needs a real backing store (and reset() relies on
// Object.keys(localStorage) to enumerate stored keys), so we install a working
// in-memory Storage here. Stored values are enumerable own properties; the
// Storage methods are non-enumerable so Object.keys() only returns real keys.
function createMemoryStorage(): Storage {
  // biome-ignore lint/suspicious/noExplicitAny: building a Storage polyfill
  const s: any = {}
  Object.defineProperties(s, {
    getItem: {
      value: (k: string) => (Object.hasOwn(s, k) ? s[k] : null),
      enumerable: false,
    },
    setItem: {
      value: (k: string, v: string) => {
        s[k] = String(v)
      },
      enumerable: false,
    },
    removeItem: {
      value: (k: string) => {
        delete s[k]
      },
      enumerable: false,
    },
    clear: {
      value: () => {
        for (const k of Object.keys(s)) delete s[k]
      },
      enumerable: false,
    },
    key: { value: (i: number) => Object.keys(s)[i] ?? null, enumerable: false },
    length: { get: () => Object.keys(s).length, enumerable: false },
  })
  return s as Storage
}

let PROJECT_ID: string

beforeEach(() => {
  global.localStorage = createMemoryStorage()
  demoStorage.initialize()
  PROJECT_ID = demoStorage.getProjects()[0].id
})

describe('initialize / reset', () => {
  it('seeds projects on first initialize', () => {
    expect(demoStorage.getProjects().length).toBeGreaterThan(0)
  })

  it('is idempotent — a second initialize does not duplicate', () => {
    const before = demoStorage.getProjects().length
    demoStorage.initialize()
    expect(demoStorage.getProjects().length).toBe(before)
  })

  it('reset clears mutations and re-seeds', () => {
    demoStorage.createProject({ name: 'Temp', key: 'TMP', color: '#000' })
    const seededCount = demoStorage.getProjects().length
    demoStorage.reset()
    expect(demoStorage.getProjects().length).toBe(seededCount - 1)
  })
})

describe('projects', () => {
  it('getProject returns the project or null', () => {
    expect(demoStorage.getProject(PROJECT_ID)?.id).toBe(PROJECT_ID)
    expect(demoStorage.getProject('nope')).toBeNull()
  })

  it('createProject adds a project and seeds its columns + counter', () => {
    const p = demoStorage.createProject({ name: 'New', key: 'NEW', color: '#fff' })
    expect(demoStorage.getProject(p.id)?.id).toBe(p.id)
    expect(demoStorage.getColumns(p.id)).toHaveLength(4)
    expect(demoStorage.getRoles(p.id).length).toBeGreaterThan(0)
  })

  it('updateProject merges fields or returns null for an unknown id', () => {
    const updated = demoStorage.updateProject(PROJECT_ID, { name: 'Renamed' })
    expect(updated?.name).toBe('Renamed')
    expect(demoStorage.updateProject('nope', { name: 'x' })).toBeNull()
  })

  it('deleteProject removes the project and its data', () => {
    const p = demoStorage.createProject({ name: 'Del', key: 'DEL', color: '#000' })
    demoStorage.deleteProject(p.id)
    expect(demoStorage.getProject(p.id)).toBeNull()
    expect(demoStorage.getColumns(p.id)).toEqual([])
  })
})

describe('tickets', () => {
  it('createTicket assigns an incrementing number and appends to the column', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const t1 = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A' })
    const t2 = demoStorage.createTicket(PROJECT_ID, colId, { title: 'B' })
    expect(t2.number).toBe(t1.number + 1)
    expect(t2.order).toBe(t1.order + 1)
    expect(demoStorage.getTicket(PROJECT_ID, t1.id)?.title).toBe('A')
  })

  it('getTicket returns null for an unknown id and revives dates', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A' })
    expect(demoStorage.getTicket(PROJECT_ID, t.id)?.createdAt).toBeInstanceOf(Date)
    expect(demoStorage.getTicket(PROJECT_ID, 'nope')).toBeNull()
  })

  it('updateTicket merges fields or returns null', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A' })
    const updated = demoStorage.updateTicket(PROJECT_ID, t.id, { priority: 'high' })
    expect(updated?.priority).toBe('high')
    expect(demoStorage.updateTicket(PROJECT_ID, 'nope', {})).toBeNull()
  })

  it('deleteTicket removes the ticket', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A' })
    demoStorage.deleteTicket(PROJECT_ID, t.id)
    expect(demoStorage.getTicket(PROJECT_ID, t.id)).toBeNull()
  })

  it('syncTickets replaces the ticket set wholesale', () => {
    demoStorage.syncTickets(PROJECT_ID, [])
    expect(demoStorage.getTickets(PROJECT_ID)).toEqual([])
  })
})

describe('comments', () => {
  it('creates, updates, and deletes comments', () => {
    const c = demoStorage.createComment(PROJECT_ID, 't1', { content: 'hi' })
    expect(demoStorage.getComments(PROJECT_ID, 't1')).toHaveLength(1)
    const updated = demoStorage.updateComment(PROJECT_ID, 't1', c.id, { content: 'edited' })
    expect(updated?.content).toBe('edited')
    expect(demoStorage.updateComment(PROJECT_ID, 't1', 'nope', { content: 'x' })).toBeNull()
    demoStorage.deleteComment(PROJECT_ID, 't1', c.id)
    expect(demoStorage.getComments(PROJECT_ID, 't1')).toEqual([])
  })
})

describe('ticket links', () => {
  it('creates a link and returns it for either endpoint', () => {
    const link = demoStorage.createTicketLink(PROJECT_ID, {
      sourceTicketId: 'a',
      targetTicketId: 'b',
      linkType: 'blocks',
    })
    expect(demoStorage.getTicketLinks(PROJECT_ID, 'a')).toHaveLength(1)
    expect(demoStorage.getTicketLinks(PROJECT_ID, 'b')).toHaveLength(1)
    expect(demoStorage.getTicketLinks(PROJECT_ID, 'c')).toEqual([])
    demoStorage.deleteTicketLink(PROJECT_ID, link.id)
    expect(demoStorage.getTicketLinks(PROJECT_ID, 'a')).toEqual([])
  })
})

describe('labels', () => {
  it('createLabel dedupes case-insensitively', () => {
    const a = demoStorage.createLabel(PROJECT_ID, { name: 'Bug', color: '#f00' })
    const b = demoStorage.createLabel(PROJECT_ID, { name: 'bug' })
    expect(b.id).toBe(a.id)
  })

  it('updateLabel cascades the change to tickets that use the label', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const label = demoStorage.createLabel(PROJECT_ID, { name: 'feat', color: '#0f0' })
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A', labels: [label] })
    demoStorage.updateLabel(PROJECT_ID, label.id, { color: '#00f' })
    const updatedTicket = demoStorage.getTicket(PROJECT_ID, t.id)
    expect(updatedTicket?.labels[0].color).toBe('#00f')
  })

  it('deleteLabel removes the label from tickets', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const label = demoStorage.createLabel(PROJECT_ID, { name: 'rm', color: '#0f0' })
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A', labels: [label] })
    demoStorage.deleteLabel(PROJECT_ID, label.id)
    expect(demoStorage.getLabels(PROJECT_ID).find((l) => l.id === label.id)).toBeUndefined()
    expect(demoStorage.getTicket(PROJECT_ID, t.id)?.labels).toEqual([])
  })
})

describe('sprints', () => {
  it('creates a sprint in planning status and reads it back with revived dates', () => {
    const s = demoStorage.createSprint(PROJECT_ID, {
      name: 'S1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-14'),
    })
    expect(s.status).toBe('planning')
    const read = demoStorage.getSprints(PROJECT_ID).find((x) => x.id === s.id)
    expect(read?.startDate).toBeInstanceOf(Date)
  })

  it('getActiveSprint returns the active one', () => {
    // Use a fresh project (no seeded sprints) so only our sprint is active.
    const fresh = demoStorage.createProject({ name: 'Fresh', key: 'FRSH', color: '#000' })
    expect(demoStorage.getActiveSprint(fresh.id)).toBeNull()
    const s = demoStorage.createSprint(fresh.id, { name: 'S1' })
    demoStorage.updateSprint(fresh.id, s.id, { status: 'active' })
    expect(demoStorage.getActiveSprint(fresh.id)?.id).toBe(s.id)
  })

  it('updateSprint returns null for an unknown id', () => {
    expect(demoStorage.updateSprint(PROJECT_ID, 'nope', {})).toBeNull()
  })

  it('deleteSprint clears the sprint from its tickets', () => {
    const colId = demoStorage.getColumns(PROJECT_ID)[0].id
    const s = demoStorage.createSprint(PROJECT_ID, { name: 'S1' })
    const t = demoStorage.createTicket(PROJECT_ID, colId, { title: 'A', sprintId: s.id })
    demoStorage.deleteSprint(PROJECT_ID, s.id)
    expect(demoStorage.getTicket(PROJECT_ID, t.id)?.sprintId).toBeNull()
  })
})

describe('members and roles', () => {
  it('getRoles computes member counts dynamically', () => {
    const roles = demoStorage.getRoles(PROJECT_ID)
    expect(roles.every((r) => typeof r.memberCount === 'number')).toBe(true)
  })

  it('addMember is a no-op for an unknown user', () => {
    const before = demoStorage.getMembers(PROJECT_ID).length
    demoStorage.addMember(PROJECT_ID, { userId: 'ghost', roleId: 'r1' })
    expect(demoStorage.getMembers(PROJECT_ID).length).toBe(before)
  })

  it('updateMember and removeMember operate on existing members', () => {
    const members = demoStorage.getMembers(PROJECT_ID)
    const member = members[0]
    const otherRole = demoStorage.getRoles(PROJECT_ID).find((r) => r.id !== member.roleId)
    if (otherRole) {
      demoStorage.updateMember(PROJECT_ID, member.id, { roleId: otherRole.id })
      const after = demoStorage
        .getMembers(PROJECT_ID)
        .find((m: { id: string }) => m.id === member.id)
      expect(after.roleId).toBe(otherRole.id)
    }
    demoStorage.removeMember(PROJECT_ID, member.id)
    expect(
      demoStorage.getMembers(PROJECT_ID).find((m: { id: string }) => m.id === member.id),
    ).toBeUndefined()
  })
})

describe('users', () => {
  it('getUsers returns the demo roster and getUser resolves by id', () => {
    const users = demoStorage.getUsers()
    expect(users.length).toBeGreaterThan(0)
    expect(demoStorage.getUser(users[0].id)?.id).toBe(users[0].id)
    expect(demoStorage.getUser('nope')).toBeNull()
  })
})
