/**
 * Data Provider Types
 *
 * Defines the interface for data operations that can be fulfilled
 * by either the API (production) or localStorage (demo mode).
 */

import type {
  ColumnWithTickets,
  IssueType,
  LabelSummary,
  Priority,
  SprintSummary,
  TicketWithRelations,
} from '@/types'

// ============================================================================
// Input Types (for create/update operations)
// ============================================================================

export interface CreateProjectInput {
  name: string
  key: string
  color: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  key?: string
  color?: string
  description?: string | null
  showAddColumnButton?: boolean | null
}

export interface CreateTicketInput {
  title: string
  description?: string | null
  type?: IssueType
  priority?: Priority
  columnId: string
  assigneeId?: string | null
  reporterId?: string | null
  sprintId?: string | null
  storyPoints?: number | null
  estimate?: string | null
  startDate?: Date | null
  dueDate?: Date | null
  resolution?: string | null
  labelIds?: string[]
  parentId?: string | null
  // For undo/restore operations - preserve original creation timestamp
  createdAt?: Date | string | null
}

export interface UpdateTicketInput {
  title?: string
  description?: string | null
  type?: IssueType
  priority?: Priority
  columnId?: string
  order?: number
  assigneeId?: string | null
  reporterId?: string | null // Maps to creatorId in database
  sprintId?: string | null
  parentId?: string | null
  storyPoints?: number | null
  estimate?: string | null
  startDate?: Date | null
  dueDate?: Date | null
  resolution?: string | null
  labelIds?: string[]
}

export interface MoveTicketInput {
  columnId: string
  order: number
}

export interface CreateLabelInput {
  name: string
  color?: string
}

export interface UpdateLabelInput {
  name?: string
  color?: string
}

export interface CreateSprintInput {
  name: string
  goal?: string
  startDate?: Date
  endDate?: Date
  budget?: number | null
}

export interface UpdateSprintInput {
  name?: string
  goal?: string
  startDate?: Date | null
  endDate?: Date | null
  budget?: number | null
}

export interface StartSprintInput {
  startDate?: Date
  endDate?: Date
}

export interface CompleteSprintInput {
  carryOverToSprintId?: string | null
  incompleteAction: 'backlog' | 'carryover' | 'keep'
}

export interface ExtendSprintInput {
  newEndDate: Date
}

// ============================================================================
// Output Types (returned from operations)
// ============================================================================

export interface ProjectSummary {
  id: string
  name: string
  key: string
  description?: string | null
  color: string
  role: string
  _count?: { tickets: number }
}

export interface ProjectWithDetails extends ProjectSummary {
  createdAt: Date
  updatedAt: Date
}

export interface UserSummary {
  id: string
  username: string
  name: string
  email: string
  avatar: string | null
}

export interface MemberSummary {
  id: string
  userId: string
  projectId: string
  role: string
  user: UserSummary
}

export interface RoleSummary {
  id: string
  name: string
  description?: string | null
  isDefault: boolean
  permissions: string[]
}

export interface DashboardStats {
  openTickets: number
  inProgress: number
  completed: number
}

export interface BrandingSettings {
  appName: string
  logoUrl: string | null
  logoLetter: string
  logoGradientFrom: string
  logoGradientTo: string
}

export interface SprintSettings {
  defaultSprintDuration: number
  autoCarryOverIncomplete: boolean
  doneColumnIds: string[]
  defaultStartTime: string // HH:mm format (e.g., "09:00")
  defaultEndTime: string // HH:mm format (e.g., "17:00")
}

// ============================================================================
// Burndown Types
// ============================================================================

export interface BurndownDataPoint {
  date: string
  day: number
  ideal: number
  remaining: number
  scope: number
  completed: number
}

export type BurndownUnit = 'points' | 'tickets'

export interface BurndownData {
  sprint: {
    id: string
    name: string
    startDate: string
    endDate: string | null
    status: string
  }
  unit: BurndownUnit
  dataPoints: BurndownDataPoint[]
}

// ============================================================================
// Data Provider Interface
// ============================================================================

export interface SearchTicketsParams {
  query: string
  limit?: number
}

export interface DataProvider {
  // Projects
  getProjects(): Promise<ProjectSummary[]>
  getProject(projectId: string): Promise<ProjectWithDetails | null>
  createProject(data: CreateProjectInput): Promise<ProjectSummary>
  updateProject(projectId: string, data: UpdateProjectInput): Promise<ProjectSummary>
  deleteProject(projectId: string): Promise<void>

  // Columns
  getColumnsWithTickets(projectId: string): Promise<ColumnWithTickets[]>

  // Tickets
  getTickets(projectId: string): Promise<TicketWithRelations[]>
  getTicket(projectId: string, ticketId: string): Promise<TicketWithRelations | null>
  searchTickets(projectId: string, params: SearchTicketsParams): Promise<TicketWithRelations[]>
  createTicket(projectId: string, data: CreateTicketInput): Promise<TicketWithRelations>
  updateTicket(
    projectId: string,
    ticketId: string,
    data: UpdateTicketInput,
  ): Promise<TicketWithRelations>
  deleteTicket(projectId: string, ticketId: string): Promise<void>
  moveTicket(
    projectId: string,
    ticketId: string,
    data: MoveTicketInput,
  ): Promise<TicketWithRelations>
  moveTickets(
    projectId: string,
    ticketIds: string[],
    toColumnId: string,
    startOrder: number,
  ): Promise<TicketWithRelations[]>

  // Labels
  getLabels(projectId: string): Promise<LabelSummary[]>
  createLabel(projectId: string, data: CreateLabelInput): Promise<LabelSummary>
  updateLabel(projectId: string, labelId: string, data: UpdateLabelInput): Promise<LabelSummary>
  deleteLabel(projectId: string, labelId: string): Promise<void>

  // Sprints
  getSprints(projectId: string): Promise<SprintSummary[]>
  getActiveSprint(projectId: string): Promise<SprintSummary | null>
  createSprint(projectId: string, data: CreateSprintInput): Promise<SprintSummary>
  updateSprint(projectId: string, sprintId: string, data: UpdateSprintInput): Promise<SprintSummary>
  deleteSprint(projectId: string, sprintId: string): Promise<void>
  startSprint(projectId: string, sprintId: string, data: StartSprintInput): Promise<SprintSummary>
  completeSprint(
    projectId: string,
    sprintId: string,
    data: CompleteSprintInput,
  ): Promise<SprintSummary>
  extendSprint(projectId: string, sprintId: string, data: ExtendSprintInput): Promise<SprintSummary>
  reopenSprint(projectId: string, sprintId: string): Promise<SprintSummary>
  getSprintSettings(projectId: string): Promise<SprintSettings>
  updateSprintSettings(projectId: string, data: Partial<SprintSettings>): Promise<SprintSettings>

  // Members (read-only in demo mode)
  getProjectMembers(projectId: string): Promise<UserSummary[]>

  // Burndown
  getBurndownData(projectId: string, sprintId: string, unit?: BurndownUnit): Promise<BurndownData>

  // Dashboard
  getDashboardStats(): Promise<DashboardStats>

  // Branding
  getBranding(): Promise<BrandingSettings>
}
