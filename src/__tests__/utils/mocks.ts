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
  isActive: true,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-14'),
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    projectId: 'project-1',
    columnId: 'col-1',
    assigneeId: null,
    creatorId: defaultUser.id,
    sprintId: defaultSprint.id,
    parentId: null,
    assignee: null,
    creator: defaultUser,
    sprint: defaultSprint,
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

// Mock file for upload tests
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024): File => {
  const blob = new Blob(['test content'], { type })
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
