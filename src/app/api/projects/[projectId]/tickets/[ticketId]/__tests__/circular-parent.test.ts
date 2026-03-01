import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all dependencies before importing routes
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    column: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn(), findMany: vi.fn() },
    ticketWatcher: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

vi.mock('@/lib/events', () => ({
  projectEvents: {
    emitTicketEvent: vi.fn(),
  },
}))

vi.mock('@/lib/auth-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return {
    ...original,
    requireAuth: vi.fn(),
    requireProjectByKey: vi.fn().mockImplementation(async (key: string) => key),
    requireTicketPermission: vi.fn(),
  }
})

vi.mock('@/lib/permissions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/permissions')>()
  return {
    ...original,
    hasPermission: vi.fn(),
    hasAnyPermission: vi.fn(),
    isMember: vi.fn(),
    getEffectivePermissions: vi.fn(),
  }
})

import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PATCH } from '../route'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockRequireAuth = vi.mocked(requireAuth)

const TEST_USER = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@test.com',
  name: 'Test',
  isSystemAdmin: false,
  isActive: true,
  avatar: null,
}

const TEST_PROJECT_ID = 'project-1'

function createPatchRequest(ticketId: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/projects/${TEST_PROJECT_ID}/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function callPatch(ticketId: string, body: unknown) {
  return PATCH(createPatchRequest(ticketId, body), {
    params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
  })
}

describe('Ticket API - Circular Parent Chain Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(TEST_USER)
  })

  it('should reject setting a ticket as its own parent', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    const response = await callPatch('ticket-A', { parentId: 'ticket-A' })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Cannot set parent: ticket cannot be its own parent')
  })

  it('should reject a direct circular reference (A->B->A)', async () => {
    // ticket-A wants parentId = ticket-B, but ticket-B already has parentId = ticket-A
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Walk up from ticket-B: ticket-B.parentId = ticket-A (cycle detected)
    mockDb.ticket.findUnique.mockResolvedValueOnce({
      parentId: 'ticket-A', // ticket-B's parent is ticket-A
    })

    const response = await callPatch('ticket-A', { parentId: 'ticket-B' })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Cannot set parent: would create a circular reference')
  })

  it('should reject a longer circular chain (A->B->C->A)', async () => {
    // ticket-A wants parentId = ticket-C
    // ticket-C.parentId = ticket-B, ticket-B.parentId = ticket-A (cycle)
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Walk up from ticket-C:
    // 1st call: ticket-C has parentId = ticket-B
    mockDb.ticket.findUnique.mockResolvedValueOnce({
      parentId: 'ticket-B',
    })
    // 2nd call: ticket-B has parentId = ticket-A (cycle detected)
    mockDb.ticket.findUnique.mockResolvedValueOnce({
      parentId: 'ticket-A',
    })

    const response = await callPatch('ticket-A', { parentId: 'ticket-C' })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Cannot set parent: would create a circular reference')
  })

  it('should allow setting a valid parent (no cycle)', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Walk up from ticket-B: ticket-B has no parent
    mockDb.ticket.findUnique.mockResolvedValueOnce({
      parentId: null,
    })

    // Mock the update call to return a full ticket
    const updatedTicket = {
      id: 'ticket-A',
      parentId: 'ticket-B',
      watchers: [],
      linkedFrom: [],
      linkedTo: [],
    }
    mockDb.ticket.update.mockResolvedValue(updatedTicket)

    const response = await callPatch('ticket-A', { parentId: 'ticket-B' })

    expect(response.status).toBe(200)
  })

  it('should allow setting parentId to null (clearing parent)', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    const updatedTicket = {
      id: 'ticket-A',
      parentId: null,
      watchers: [],
      linkedFrom: [],
      linkedTo: [],
    }
    mockDb.ticket.update.mockResolvedValue(updatedTicket)

    const response = await callPatch('ticket-A', { parentId: null })

    expect(response.status).toBe(200)
    // Should not call findUnique for chain walk when clearing parent
    expect(mockDb.ticket.findUnique).not.toHaveBeenCalled()
  })

  it('should allow valid deep parent chains within the depth limit', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Build a chain of 5 levels: B -> C -> D -> E -> F (no parent)
    mockDb.ticket.findUnique
      .mockResolvedValueOnce({ parentId: 'ticket-C' }) // ticket-B
      .mockResolvedValueOnce({ parentId: 'ticket-D' }) // ticket-C
      .mockResolvedValueOnce({ parentId: 'ticket-E' }) // ticket-D
      .mockResolvedValueOnce({ parentId: 'ticket-F' }) // ticket-E
      .mockResolvedValueOnce({ parentId: null }) // ticket-F (root)

    const updatedTicket = {
      id: 'ticket-A',
      parentId: 'ticket-B',
      watchers: [],
      linkedFrom: [],
      linkedTo: [],
    }
    mockDb.ticket.update.mockResolvedValue(updatedTicket)

    const response = await callPatch('ticket-A', { parentId: 'ticket-B' })

    expect(response.status).toBe(200)
  })

  it('should reject when parent chain exceeds maximum depth', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Simulate a chain that never terminates (always returns a parent)
    // The validation should bail out after 50 iterations
    mockDb.ticket.findUnique.mockResolvedValue({
      parentId: 'ticket-infinite',
    })

    const response = await callPatch('ticket-A', { parentId: 'ticket-B' })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Cannot set parent: parent chain exceeds maximum depth')
  })

  it('should handle parent not found in database gracefully', async () => {
    mockDb.ticket.findFirst.mockResolvedValue({
      id: 'ticket-A',
      columnId: 'col-1',
      sprintId: null,
      creatorId: TEST_USER.id,
      resolution: null,
      column: { name: 'To Do' },
    })

    // Parent ticket not found in database (deleted or invalid)
    mockDb.ticket.findUnique.mockResolvedValueOnce(null)

    const updatedTicket = {
      id: 'ticket-A',
      parentId: 'ticket-B',
      watchers: [],
      linkedFrom: [],
      linkedTo: [],
    }
    mockDb.ticket.update.mockResolvedValue(updatedTicket)

    const response = await callPatch('ticket-A', { parentId: 'ticket-B' })

    // Should not error - treat missing parent as end of chain
    expect(response.status).toBe(200)
  })
})
