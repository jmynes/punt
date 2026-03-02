import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all dependencies before importing routes
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    ticket: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    column: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn(), findMany: vi.fn() },
    ticketWatcher: { deleteMany: vi.fn(), createMany: vi.fn() },
    ticketSprintHistory: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    role: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/events', () => ({
  projectEvents: {
    emitTicketEvent: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logTicketCreated: vi.fn().mockResolvedValue('activity-1'),
  logBatchChanges: vi.fn().mockResolvedValue({ activityIds: [] }),
  computeTicketChanges: vi.fn().mockReturnValue([]),
  createActivityGroupId: vi.fn().mockReturnValue('group-1'),
}))

vi.mock('@/lib/auth-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return {
    ...original,
    requireAuth: vi.fn(),
    requireProjectByKey: vi.fn().mockImplementation(async (key: string) => key),
    requireMembership: vi.fn().mockResolvedValue(undefined),
    requirePermission: vi.fn().mockResolvedValue(undefined),
    requireTicketPermission: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/permissions/check', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  hasAnyPermission: vi.fn().mockResolvedValue(true),
  hasAllPermissions: vi.fn(),
  isMember: vi.fn().mockResolvedValue(true),
  getEffectivePermissions: vi.fn(),
  getRolePermissions: vi.fn(),
  canManageMember: vi.fn(),
  canAssignRole: vi.fn(),
}))

import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PATCH } from '../[ticketId]/route'
import { POST } from '../route'

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

function createPostRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/projects/${TEST_PROJECT_ID}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createPatchRequest(ticketId: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/projects/${TEST_PROJECT_ID}/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const EXISTING_TICKET_BASE = {
  id: 'ticket-1',
  title: 'My Task',
  description: null,
  type: 'task',
  priority: 'medium',
  columnId: 'col-1',
  assigneeId: null,
  creatorId: 'user-1',
  sprintId: null,
  parentId: null,
  storyPoints: null,
  estimate: null,
  resolution: null,
  resolvedAt: null,
  startDate: null,
  dueDate: null,
  environment: null,
  affectedVersion: null,
  fixVersion: null,
  column: { name: 'To Do', icon: null, color: null },
  assignee: null,
  sprint: null,
  labels: [],
}

function createUpdatedTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    number: 1,
    title: 'My Task',
    type: 'task',
    parentId: null,
    projectId: TEST_PROJECT_ID,
    columnId: 'col-1',
    column: { name: 'To Do', icon: null, color: null },
    creatorId: TEST_USER.id,
    assigneeId: null,
    sprintId: null,
    sprint: null,
    watchers: [],
    linkedFrom: [],
    linkedTo: [],
    labels: [],
    _count: { comments: 0, subtasks: 0, attachments: 0 },
    ...overrides,
  }
}

/**
 * Helper to mock db.ticket.update so it returns a Promise with .catch()
 * (matching Prisma's fluent API pattern used in the PATCH handler).
 *
 * The handler chains `.catch()` directly on the return value of
 * `db.ticket.update()`, which works because Promises have .catch().
 */
// biome-ignore lint/suspicious/noExplicitAny: mock typing
function mockTicketUpdate(resolvedValue: any) {
  mockDb.ticket.update.mockResolvedValue(resolvedValue)
}

describe('Nested Subtask Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(TEST_USER)
  })

  describe('POST /api/projects/[projectId]/tickets - Create', () => {
    it('should reject creating a ticket with a subtask as parent', async () => {
      mockDb.column.findFirst.mockResolvedValue({ id: 'col-1', projectId: TEST_PROJECT_ID })
      mockDb.ticket.findFirst.mockResolvedValue({ type: 'subtask' })

      const response = await POST(
        createPostRequest({
          title: 'Child of subtask',
          columnId: 'col-1',
          type: 'subtask',
          parentId: 'parent-subtask-id',
        }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID }) },
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Subtasks cannot have subtasks')
    })

    it('should reject creating any ticket type with a subtask as parent', async () => {
      mockDb.column.findFirst.mockResolvedValue({ id: 'col-1', projectId: TEST_PROJECT_ID })
      mockDb.ticket.findFirst.mockResolvedValue({ type: 'subtask' })

      const response = await POST(
        createPostRequest({
          title: 'Task under subtask',
          columnId: 'col-1',
          type: 'task',
          parentId: 'parent-subtask-id',
        }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID }) },
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Subtasks cannot have subtasks')
    })

    it('should return 400 when parent ticket does not exist', async () => {
      mockDb.column.findFirst.mockResolvedValue({ id: 'col-1', projectId: TEST_PROJECT_ID })
      mockDb.ticket.findFirst.mockResolvedValue(null)

      const response = await POST(
        createPostRequest({
          title: 'Orphan subtask',
          columnId: 'col-1',
          type: 'subtask',
          parentId: 'nonexistent-id',
        }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID }) },
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Parent ticket not found or does not belong to project')
    })

    it('should allow creating a subtask with a non-subtask parent', async () => {
      mockDb.column.findFirst.mockResolvedValue({ id: 'col-1', projectId: TEST_PROJECT_ID })
      mockDb.ticket.findFirst.mockResolvedValue({ type: 'task' })

      const createdTicket = createUpdatedTicket({
        title: 'Valid subtask',
        type: 'subtask',
        parentId: 'parent-task-id',
      })
      // biome-ignore lint/suspicious/noExplicitAny: mock typing
      ;(mockDb.$transaction as any).mockImplementation(async (_fn: any) => createdTicket)

      const response = await POST(
        createPostRequest({
          title: 'Valid subtask',
          columnId: 'col-1',
          type: 'subtask',
          parentId: 'parent-task-id',
        }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID }) },
      )

      expect(response.status).toBe(201)
    })

    it('should allow creating a ticket without a parent', async () => {
      mockDb.column.findFirst.mockResolvedValue({ id: 'col-1', projectId: TEST_PROJECT_ID })

      const createdTicket = createUpdatedTicket({ title: 'Standalone task' })
      // biome-ignore lint/suspicious/noExplicitAny: mock typing
      ;(mockDb.$transaction as any).mockImplementation(async (_fn: any) => createdTicket)

      const response = await POST(
        createPostRequest({
          title: 'Standalone task',
          columnId: 'col-1',
          type: 'task',
        }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID }) },
      )

      expect(response.status).toBe(201)
    })
  })

  describe('PATCH /api/projects/[projectId]/tickets/[ticketId] - Update', () => {
    it('should reject setting parentId to a subtask ticket', async () => {
      const ticketId = 'ticket-1'

      // First findFirst: existing ticket lookup
      mockDb.ticket.findFirst.mockResolvedValueOnce({ ...EXISTING_TICKET_BASE, id: ticketId })
      // Second findFirst: parent ticket type check
      mockDb.ticket.findFirst.mockResolvedValueOnce({ type: 'subtask' })

      const response = await PATCH(createPatchRequest(ticketId, { parentId: 'subtask-parent' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Subtasks cannot have subtasks')
    })

    it('should reject changing type to subtask when ticket has children', async () => {
      const ticketId = 'ticket-1'

      // Existing ticket (task type)
      mockDb.ticket.findFirst.mockResolvedValueOnce({ ...EXISTING_TICKET_BASE, id: ticketId })
      // Ticket has 2 children
      mockDb.ticket.count.mockResolvedValueOnce(2)

      const response = await PATCH(createPatchRequest(ticketId, { type: 'subtask' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Cannot make a ticket with subtasks into a subtask')
    })

    it('should allow changing type to subtask when ticket has no children', async () => {
      const ticketId = 'ticket-1'

      // Existing ticket (task type)
      mockDb.ticket.findFirst.mockResolvedValueOnce({ ...EXISTING_TICKET_BASE, id: ticketId })
      // No children
      mockDb.ticket.count.mockResolvedValueOnce(0)
      // Mock the update result
      mockTicketUpdate(
        createUpdatedTicket({ id: ticketId, title: 'Childless Task', type: 'subtask' }),
      )

      const response = await PATCH(createPatchRequest(ticketId, { type: 'subtask' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
      })

      expect(response.status).toBe(200)
    })

    it('should allow setting parentId to a non-subtask ticket', async () => {
      const ticketId = 'ticket-1'
      const parentId = 'parent-task-id'

      // First findFirst: existing ticket
      mockDb.ticket.findFirst.mockResolvedValueOnce({
        ...EXISTING_TICKET_BASE,
        id: ticketId,
        type: 'subtask',
      })
      // Second findFirst: parent ticket type check (task = valid)
      mockDb.ticket.findFirst.mockResolvedValueOnce({ type: 'task' })
      // Walk parent chain: parent has no parent -> loop ends
      mockDb.ticket.findUnique.mockResolvedValueOnce({ parentId: null })

      mockTicketUpdate(createUpdatedTicket({ id: ticketId, type: 'subtask', parentId }))

      const response = await PATCH(createPatchRequest(ticketId, { parentId }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
      })

      expect(response.status).toBe(200)
    })

    it('should reject setting parentId to a nonexistent ticket', async () => {
      const ticketId = 'ticket-1'

      // First findFirst: existing ticket
      mockDb.ticket.findFirst.mockResolvedValueOnce({ ...EXISTING_TICKET_BASE, id: ticketId })
      // Second findFirst: parent not found
      mockDb.ticket.findFirst.mockResolvedValueOnce(null)

      const response = await PATCH(createPatchRequest(ticketId, { parentId: 'nonexistent-id' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Parent ticket not found or does not belong to project')
    })

    it('should skip subtask check when type is already subtask', async () => {
      const ticketId = 'ticket-1'

      // Existing ticket is already a subtask
      mockDb.ticket.findFirst.mockResolvedValueOnce({
        ...EXISTING_TICKET_BASE,
        id: ticketId,
        type: 'subtask',
        parentId: 'some-parent',
      })

      mockTicketUpdate(
        createUpdatedTicket({
          id: ticketId,
          title: 'Renamed Subtask',
          type: 'subtask',
          parentId: 'some-parent',
        }),
      )

      const response = await PATCH(
        createPatchRequest(ticketId, { title: 'Renamed Subtask', type: 'subtask' }),
        { params: Promise.resolve({ projectId: TEST_PROJECT_ID, ticketId }) },
      )

      // Should not call ticket.count because existing type is already subtask
      expect(mockDb.ticket.count).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })
})
