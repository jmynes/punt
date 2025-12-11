// Re-export Prisma types
export type {
  Attachment,
  Column,
  Comment,
  Label,
  Project,
  ProjectMember,
  Sprint,
  Ticket,
  TicketEdit,
  TicketLink,
  TicketWatcher,
  User,
} from '@/generated/prisma/client'

// Issue types
export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

// Priority levels for tickets
export const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

// Project member roles
export const ROLES = ['owner', 'admin', 'member'] as const
export type Role = (typeof ROLES)[number]

// Link types between tickets
export const LINK_TYPES = [
  'blocks',
  'is_blocked_by',
  'relates_to',
  'duplicates',
  'is_duplicated_by',
  'clones',
  'is_cloned_by',
] as const
export type LinkType = (typeof LINK_TYPES)[number]

// User summary for display
export interface UserSummary {
  id: string
  name: string
  email: string
  avatar: string | null
}

// Label for display
export interface LabelSummary {
  id: string
  name: string
  color: string
}

// Sprint summary
export interface SprintSummary {
  id: string
  name: string
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
}

// Extended types with relations
export interface TicketWithRelations {
  id: string
  number: number
  title: string
  description: string | null
  type: IssueType
  priority: Priority
  order: number
  storyPoints: number | null
  estimate: string | null
  startDate: Date | null
  dueDate: Date | null
  environment: string | null
  affectedVersion: string | null
  fixVersion: string | null
  createdAt: Date
  updatedAt: Date
  projectId: string
  columnId: string
  assigneeId: string | null
  creatorId: string
  sprintId: string | null
  parentId: string | null
  assignee: UserSummary | null
  creator: UserSummary
  sprint: SprintSummary | null
  labels: LabelSummary[]
  watchers: UserSummary[]
  _count?: {
    comments: number
    subtasks: number
    attachments: number
  }
}

export interface ColumnWithTickets {
  id: string
  name: string
  order: number
  projectId: string
  tickets: TicketWithRelations[]
}

export interface ProjectWithDetails {
  id: string
  name: string
  key: string
  description: string | null
  color: string
  createdAt: Date
  updatedAt: Date
  columns: ColumnWithTickets[]
  members: {
    id: string
    role: Role
    user: UserSummary
  }[]
  labels: LabelSummary[]
  sprints: SprintSummary[]
  _count: {
    tickets: number
  }
}

// Uploaded file info for attachments
export interface UploadedFileInfo {
  id: string
  filename: string
  originalName: string
  mimetype: string
  size: number
  url: string
  category: 'image' | 'video' | 'document'
}

// Form data for creating/editing tickets
export interface TicketFormData {
  title: string
  description: string
  type: IssueType
  priority: Priority
  columnId?: string
  assigneeId: string | null
  sprintId: string | null
  labelIds: string[]
  watcherIds: string[]
  storyPoints: number | null
  estimate: string
  startDate: Date | null
  dueDate: Date | null
  environment: string
  affectedVersion: string
  fixVersion: string
  parentId: string | null
  attachments: UploadedFileInfo[]
}

// Default values for new tickets
export const DEFAULT_TICKET_FORM: TicketFormData = {
  title: '',
  description: '',
  type: 'task',
  priority: 'medium',
  columnId: undefined,
  assigneeId: null,
  sprintId: null,
  labelIds: [],
  watcherIds: [],
  storyPoints: 1,
  estimate: '',
  startDate: null,
  dueDate: null,
  environment: '',
  affectedVersion: '',
  fixVersion: '',
  parentId: null,
  attachments: [],
}
