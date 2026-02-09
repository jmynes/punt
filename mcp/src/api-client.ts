/**
 * API client for PUNT server
 * Uses the MCP_API_KEY for authentication and handles all HTTP communication
 */

const API_BASE_URL = process.env.PUNT_API_URL || 'http://localhost:3000'
const MCP_API_KEY = process.env.MCP_API_KEY

if (!MCP_API_KEY) {
  console.error('Warning: MCP_API_KEY not set. API calls will fail authentication.')
}

interface ApiResponse<T> {
  data?: T
  error?: string
}

/**
 * Make an authenticated request to the PUNT API
 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-API-Key': MCP_API_KEY || '',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      let errorMessage: string
      try {
        const errorJson = JSON.parse(text)
        errorMessage = errorJson.error || errorJson.message || text
      } catch {
        errorMessage = text || `HTTP ${response.status}`
      }
      return { error: errorMessage }
    }

    // Handle empty responses (204 No Content, etc.)
    const text = await response.text()
    if (!text) {
      return { data: undefined as T }
    }

    const data = JSON.parse(text) as T
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API request failed: ${message}` }
  }
}

// ============================================================================
// Tickets API
// ============================================================================

export interface TicketData {
  id: string
  number: number
  title: string
  description: string | null
  type: string
  priority: string
  storyPoints: number | null
  estimate: string | null
  startDate: string | null
  dueDate: string | null
  environment: string | null
  affectedVersion: string | null
  fixVersion: string | null
  column: { id: string; name: string }
  sprint: { id: string; name: string; status: string } | null
  assignee: { id: string; name: string; email: string | null } | null
  creator: { id: string; name: string } | null
  labels: Array<{ id: string; name: string; color: string }>
  project?: { id: string; key: string; name: string }
}

export async function getTicket(projectKey: string, ticketNumber: number) {
  // First get all tickets and find by number (API doesn't have direct get by number)
  const result = await listTickets(projectKey)
  if (result.error) return result
  const ticket = result.data?.find((t) => t.number === ticketNumber)
  if (!ticket) {
    return { error: `Ticket ${projectKey}-${ticketNumber} not found` }
  }
  return { data: ticket }
}

export async function listTickets(projectKey: string) {
  return apiRequest<TicketData[]>('GET', `/api/projects/${projectKey}/tickets`)
}

export interface CreateTicketInput {
  title: string
  description?: string | null
  type?: string
  priority?: string
  columnId: string
  assigneeId?: string | null
  sprintId?: string | null
  parentId?: string | null
  storyPoints?: number | null
  estimate?: string | null
  startDate?: string | null
  dueDate?: string | null
  environment?: string | null
  affectedVersion?: string | null
  fixVersion?: string | null
  labelIds?: string[]
}

export async function createTicket(projectKey: string, data: CreateTicketInput) {
  return apiRequest<TicketData>('POST', `/api/projects/${projectKey}/tickets`, data)
}

export interface UpdateTicketInput {
  title?: string
  description?: string | null
  type?: string
  priority?: string
  columnId?: string
  assigneeId?: string | null
  sprintId?: string | null
  parentId?: string | null
  storyPoints?: number | null
  estimate?: string | null
  startDate?: string | null
  dueDate?: string | null
  environment?: string | null
  affectedVersion?: string | null
  fixVersion?: string | null
  labelIds?: string[]
}

export async function updateTicket(projectKey: string, ticketId: string, data: UpdateTicketInput) {
  return apiRequest<TicketData>('PATCH', `/api/projects/${projectKey}/tickets/${ticketId}`, data)
}

export async function deleteTicket(projectKey: string, ticketId: string) {
  return apiRequest<void>('DELETE', `/api/projects/${projectKey}/tickets/${ticketId}`)
}

// ============================================================================
// Projects API
// ============================================================================

export interface ProjectData {
  id: string
  key: string
  name: string
  description: string | null
  color: string
  columns?: Array<{ id: string; name: string; order: number }>
  members?: Array<{ user: { id: string; name: string }; role: { name: string } }>
  _count?: { tickets: number; members: number }
}

export async function listProjects() {
  return apiRequest<ProjectData[]>('GET', '/api/projects')
}

export async function getProject(projectKey: string) {
  return apiRequest<ProjectData>('GET', `/api/projects/${projectKey}`)
}

export interface CreateProjectInput {
  name: string
  key: string
  description?: string
  color?: string
}

export async function createProject(data: CreateProjectInput) {
  return apiRequest<ProjectData>('POST', '/api/projects', data)
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
  color?: string
}

export async function updateProject(projectKey: string, data: UpdateProjectInput) {
  return apiRequest<ProjectData>('PATCH', `/api/projects/${projectKey}`, data)
}

export async function deleteProject(projectKey: string) {
  return apiRequest<void>('DELETE', `/api/projects/${projectKey}`)
}

// ============================================================================
// Columns API
// ============================================================================

export interface ColumnData {
  id: string
  name: string
  order: number
}

export async function listColumns(projectKey: string) {
  return apiRequest<ColumnData[]>('GET', `/api/projects/${projectKey}/columns`)
}

export interface CreateColumnInput {
  name: string
  order?: number
}

export async function createColumn(projectKey: string, data: CreateColumnInput) {
  return apiRequest<ColumnData>('POST', `/api/projects/${projectKey}/columns`, data)
}

export interface UpdateColumnInput {
  name?: string
  order?: number
}

export async function updateColumn(projectKey: string, columnId: string, data: UpdateColumnInput) {
  return apiRequest<ColumnData>('PATCH', `/api/projects/${projectKey}/columns/${columnId}`, data)
}

export async function deleteColumn(
  projectKey: string,
  columnId: string,
  moveTicketsToColumnId: string,
) {
  return apiRequest<void>(
    'DELETE',
    `/api/projects/${projectKey}/columns/${columnId}?moveTicketsTo=${moveTicketsToColumnId}`,
  )
}

// ============================================================================
// Sprints API
// ============================================================================

export interface SprintData {
  id: string
  name: string
  status: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  budget: number | null
  tickets?: TicketData[]
}

export async function listSprints(projectKey: string) {
  return apiRequest<SprintData[]>('GET', `/api/projects/${projectKey}/sprints`)
}

export async function getSprint(projectKey: string, sprintId: string) {
  return apiRequest<SprintData>('GET', `/api/projects/${projectKey}/sprints/${sprintId}`)
}

export interface CreateSprintInput {
  name: string
  goal?: string | null
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
}

export async function createSprint(projectKey: string, data: CreateSprintInput) {
  return apiRequest<SprintData>('POST', `/api/projects/${projectKey}/sprints`, data)
}

export interface UpdateSprintInput {
  name?: string
  goal?: string | null
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
}

export async function updateSprint(projectKey: string, sprintId: string, data: UpdateSprintInput) {
  return apiRequest<SprintData>('PATCH', `/api/projects/${projectKey}/sprints/${sprintId}`, data)
}

export async function startSprint(
  projectKey: string,
  sprintId: string,
  data?: { startDate?: string; endDate?: string },
) {
  return apiRequest<SprintData>(
    'POST',
    `/api/projects/${projectKey}/sprints/${sprintId}/start`,
    data || {},
  )
}

export async function completeSprint(
  projectKey: string,
  sprintId: string,
  data?: { moveIncompleteTo?: 'backlog' | 'next' },
) {
  return apiRequest<SprintData>(
    'POST',
    `/api/projects/${projectKey}/sprints/${sprintId}/complete`,
    data || {},
  )
}

export async function deleteSprint(projectKey: string, sprintId: string) {
  return apiRequest<void>('DELETE', `/api/projects/${projectKey}/sprints/${sprintId}`)
}

// ============================================================================
// Members API
// ============================================================================

export interface MemberData {
  id: string
  user: { id: string; name: string; email: string | null }
  role: { id: string; name: string }
}

export async function listMembers(projectKey: string) {
  return apiRequest<MemberData[]>('GET', `/api/projects/${projectKey}/members`)
}

export interface AddMemberInput {
  userId: string
  roleId: string
}

export async function addMember(projectKey: string, data: AddMemberInput) {
  return apiRequest<MemberData>('POST', `/api/projects/${projectKey}/members`, data)
}

export async function removeMember(projectKey: string, memberId: string) {
  return apiRequest<void>('DELETE', `/api/projects/${projectKey}/members/${memberId}`)
}

export async function updateMemberRole(projectKey: string, memberId: string, roleId: string) {
  return apiRequest<MemberData>('PATCH', `/api/projects/${projectKey}/members/${memberId}`, {
    roleId,
  })
}

// ============================================================================
// Labels API
// ============================================================================

export interface LabelData {
  id: string
  name: string
  color: string
}

export async function listLabels(projectKey: string) {
  return apiRequest<LabelData[]>('GET', `/api/projects/${projectKey}/labels`)
}

export interface CreateLabelInput {
  name: string
  color?: string
}

export async function createLabel(projectKey: string, data: CreateLabelInput) {
  return apiRequest<LabelData>('POST', `/api/projects/${projectKey}/labels`, data)
}

export async function deleteLabel(projectKey: string, labelId: string) {
  return apiRequest<void>('DELETE', `/api/projects/${projectKey}/labels/${labelId}`)
}

// ============================================================================
// Users API
// ============================================================================

export interface UserData {
  id: string
  name: string
  email: string | null
  isSystemAdmin: boolean
}

export async function listUsers() {
  return apiRequest<UserData[]>('GET', '/api/admin/users')
}

// ============================================================================
// Roles API (for member management)
// ============================================================================

export interface RoleData {
  id: string
  name: string
}

export async function listRoles(projectKey: string) {
  // Roles come with project details
  const result = await getProject(projectKey)
  if (result.error) return { error: result.error }

  // We need to fetch roles from the project settings endpoint
  // For now, return default roles
  return {
    data: [
      { id: 'owner', name: 'Owner' },
      { id: 'admin', name: 'Admin' },
      { id: 'member', name: 'Member' },
    ] as RoleData[],
  }
}
