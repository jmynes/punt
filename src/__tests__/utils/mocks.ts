import type {
  ColumnWithTickets,
  IssueType,
  LabelSummary,
  Priority,
  SprintSummary,
  TicketWithRelations,
  UserSummary,
} from '@/types'

// Mock user data
export const createMockUser = (overrides?: Partial<UserSummary>): UserSummary => ({
  id: 'user-1',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  avatar: null,
  ...overrides,
})

// Mock label data
export const createMockLabel = (overrides?: Partial<LabelSummary>): LabelSummary => ({
  id: 'label-1',
  name: 'test-label',
  color: '#10b981',
  ...overrides,
})

// Mock sprint data
export const createMockSprint = (overrides?: Partial<SprintSummary>): SprintSummary => ({
  id: 'sprint-1',
  name: 'Sprint 1',
  status: 'active',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-14'),
  goal: null,
  budget: null,
  ...overrides,
})

// Mock ticket data
export const createMockTicket = (overrides?: Partial<TicketWithRelations>): TicketWithRelations => {
  const defaultUser = createMockUser()
  const defaultSprint = createMockSprint()

  return {
    id: 'ticket-1',
    number: 1,
    title: 'Test Ticket',
    description: 'Test description',
    type: 'task' as IssueType,
    priority: 'medium' as Priority,
    order: 0,
    storyPoints: 5,
    estimate: '1d',
    startDate: null,
    dueDate: null,
    environment: null,
    affectedVersion: null,
    fixVersion: null,
    resolution: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    projectId: 'project-1',
    columnId: 'col-1',
    assigneeId: null,
    creatorId: defaultUser.id,
    sprintId: defaultSprint.id,
    parentId: null,
    isCarriedOver: false,
    carriedFromSprintId: null,
    carriedOverCount: 0,
    assignee: null,
    creator: defaultUser,
    sprint: defaultSprint,
    carriedFromSprint: null,
    labels: [],
    watchers: [],
    _count: {
      comments: 0,
      subtasks: 0,
      attachments: 0,
    },
    ...overrides,
  }
}

// Mock column data
export const createMockColumn = (overrides?: Partial<ColumnWithTickets>): ColumnWithTickets => ({
  id: 'col-1',
  name: 'To Do',
  order: 0,
  projectId: 'project-1',
  tickets: [],
  ...overrides,
})

// Mock columns with tickets (4 columns: To Do, In Progress, Review, Done)
export const createMockColumns = (): ColumnWithTickets[] => [
  createMockColumn({
    id: 'col-1',
    name: 'To Do',
    order: 0,
    tickets: [createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })],
  }),
  createMockColumn({
    id: 'col-2',
    name: 'In Progress',
    order: 1,
    tickets: [createMockTicket({ id: 'ticket-2', columnId: 'col-2', order: 0 })],
  }),
  createMockColumn({
    id: 'col-3',
    name: 'Review',
    order: 2,
    tickets: [],
  }),
  createMockColumn({
    id: 'col-4',
    name: 'Done',
    order: 3,
    tickets: [],
  }),
]

// Magic byte patterns for common file types
const MAGIC_BYTES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  'image/webp': new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]),
  'video/mp4': new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34]),
  'video/webm': new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
  'application/pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
}

// Mock file for upload tests
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024): File => {
  // Use magic bytes for the file type if available, otherwise use placeholder content
  const magicBytes = MAGIC_BYTES[type]
  let content: BlobPart

  if (magicBytes) {
    // Create content with proper magic bytes plus padding to reach size
    const padding = new Uint8Array(Math.max(0, size - magicBytes.length))
    const fullContent = new Uint8Array(magicBytes.length + padding.length)
    fullContent.set(magicBytes, 0)
    fullContent.set(padding, magicBytes.length)
    content = fullContent
  } else {
    // For text files or unknown types, use text content
    content = 'test content'.padEnd(size, ' ')
  }

  const blob = new Blob([content], { type })
  const file = new File([blob], name, { type })
  // Ensure size is set correctly
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
    configurable: true,
  })
  // Ensure name is preserved
  Object.defineProperty(file, 'name', {
    value: name,
    writable: false,
    configurable: true,
  })
  return file
}

// Mock FormData for upload tests
export const createMockFormData = (files: File[]): FormData => {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })
  return formData
}
