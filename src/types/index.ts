// Import Prisma types for use within this file
import type { Role as PrismaRole } from '@/generated/prisma'

// Import permission types for use within this file
import type { Permission as PermissionType } from '@/lib/permissions'

// Re-export Prisma types
export type {
  Attachment,
  Column,
  Comment,
  Label,
  Project,
  ProjectMember,
  ProjectSprintSettings,
  Role,
  Sprint,
  Ticket,
  TicketEdit,
  TicketLink,
  TicketSprintHistory,
  TicketWatcher,
  User,
} from '@/generated/prisma'

// Re-export permission types
export type {
  CategoryMeta,
  Permission,
  PermissionCategory,
  PermissionMeta,
} from '@/lib/permissions'

// Issue types
export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

// Priority levels for tickets
export const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

// Legacy project member roles (kept for backwards compatibility)
// @deprecated Use the new Role model with granular permissions instead
export const LEGACY_ROLES = ['owner', 'admin', 'member'] as const
export type LegacyRole = (typeof LEGACY_ROLES)[number]

// Alias for backwards compatibility
export const ROLES = LEGACY_ROLES

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

// Display names for link types
export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  blocks: 'Blocks',
  is_blocked_by: 'Is blocked by',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
  is_duplicated_by: 'Is duplicated by',
  clones: 'Clones',
  is_cloned_by: 'Is cloned by',
}

// Inverse link types for bidirectional display
export const INVERSE_LINK_TYPES: Record<LinkType, LinkType> = {
  blocks: 'is_blocked_by',
  is_blocked_by: 'blocks',
  relates_to: 'relates_to',
  duplicates: 'is_duplicated_by',
  is_duplicated_by: 'duplicates',
  clones: 'is_cloned_by',
  is_cloned_by: 'clones',
}

// Resolution values for closed/done tickets
export const RESOLUTIONS = [
  'Done',
  "Won't Fix",
  'Duplicate',
  'Cannot Reproduce',
  'Incomplete',
  "Won't Do",
] as const
export type Resolution = (typeof RESOLUTIONS)[number]

// Sprint status constants
export const SPRINT_STATUSES = ['planning', 'active', 'completed'] as const
export type SprintStatus = (typeof SPRINT_STATUSES)[number]

// Entry types for sprint history
export const SPRINT_ENTRY_TYPES = ['added', 'carried_over'] as const
export type SprintEntryType = (typeof SPRINT_ENTRY_TYPES)[number]

// Exit statuses for sprint history
export const SPRINT_EXIT_STATUSES = ['completed', 'carried_over', 'removed'] as const
export type SprintExitStatus = (typeof SPRINT_EXIT_STATUSES)[number]

// Invitation statuses
export const INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

// Invitation roles (subset of project roles allowed for invitations)
export const INVITATION_ROLES = ['admin', 'member'] as const
export type InvitationRole = (typeof INVITATION_ROLES)[number]

// Sprint completion action types
export type SprintCompletionAction = 'extend' | 'close_to_next' | 'close_to_backlog' | 'close_keep'

// Sprint completion options
export interface SprintCompletionOptions {
  action: SprintCompletionAction
  extendDays?: number
  targetSprintId?: string
  createNextSprint?: boolean
  doneColumnIds?: string[]
}

// User summary for display
export interface UserSummary {
  id: string
  username: string
  name: string
  email: string
  avatar: string | null
  avatarColor?: string | null
  isSystemAdmin?: boolean
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
  status: SprintStatus
  startDate: Date | null
  endDate: Date | null
  goal?: string | null
  budget?: number | null
}

// Full sprint with completion metrics
export interface SprintWithMetrics extends SprintSummary {
  budget: number | null
  completedAt: Date | null
  completedById: string | null
  completedTicketCount: number | null
  incompleteTicketCount: number | null
  completedStoryPoints: number | null
  incompleteStoryPoints: number | null
  createdAt: Date
  updatedAt: Date
}

// Sprint completion result
export interface SprintCompletionResult {
  sprint: SprintWithMetrics
  ticketDisposition: {
    completed: string[]
    movedToBacklog: string[]
    carriedOver: string[]
  }
  nextSprint?: SprintSummary
}

// Project sprint settings
export interface ProjectSprintSettingsData {
  defaultSprintDuration: number
  autoCarryOverIncomplete: boolean
  doneColumnIds: string[]
}

// Attachment info from database
export interface AttachmentInfo {
  id: string
  filename: string
  mimeType: string
  size: number
  url: string
  createdAt: Date
}

// Ticket link summary for display
export interface TicketLinkSummary {
  id: string
  linkType: LinkType
  linkedTicket: {
    id: string
    number: number
    title: string
    type: IssueType
    priority: Priority
    columnId: string
    resolution: string | null
  }
  direction: 'outward' | 'inward'
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
  resolution: string | null
  resolvedAt: Date | null
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
  // Carryover tracking
  isCarriedOver: boolean
  carriedFromSprintId: string | null
  carriedOverCount: number
  assignee: UserSummary | null
  creator: UserSummary
  sprint: SprintSummary | null
  carriedFromSprint: SprintSummary | null
  labels: LabelSummary[]
  watchers: UserSummary[]
  attachments?: AttachmentInfo[]
  links?: TicketLinkSummary[]
  _count?: {
    comments: number
    subtasks: number
    attachments: number
  }
}

export interface ColumnWithTickets {
  id: string
  name: string
  icon?: string | null
  color?: string | null
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
    role: PrismaRole
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
  reporterId: string | null
  sprintId: string | null
  labelIds: string[]
  watcherIds: string[]
  storyPoints: number | null
  estimate: string
  startDate: Date | null
  dueDate: Date | null
  resolution: string | null
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
  reporterId: null,
  sprintId: null,
  labelIds: [],
  watcherIds: [],
  storyPoints: 1,
  estimate: '',
  startDate: null,
  dueDate: null,
  resolution: null,
  environment: '',
  affectedVersion: '',
  fixVersion: '',
  parentId: null,
  attachments: [],
}

// ============================================================================
// Role-Based Permission System Types
// ============================================================================

// Role summary for display
export interface RoleSummary {
  id: string
  name: string
  color: string
  description: string | null
  isDefault: boolean
  position: number
}

// Role with parsed permissions
export interface RoleWithPermissions extends RoleSummary {
  permissions: PermissionType[]
  memberCount?: number
}

// Project member with role details
export interface ProjectMemberWithRole {
  id: string
  roleId: string
  overrides: PermissionType[] | null
  userId: string
  projectId: string
  createdAt: Date
  updatedAt: Date
  user: UserSummary
  role: RoleSummary
}

// Full member details with effective permissions
export interface ProjectMemberDetails extends ProjectMemberWithRole {
  effectivePermissions: PermissionType[]
}

// Project with roles
export interface ProjectWithRoles {
  id: string
  name: string
  key: string
  description: string | null
  color: string
  roles: RoleSummary[]
  members: ProjectMemberWithRole[]
}
