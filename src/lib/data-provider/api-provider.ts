/**
 * API Data Provider
 *
 * Implementation of DataProvider that uses the REST API.
 * Used in production mode.
 */

import type { ColumnWithTickets, LabelSummary, SprintSummary, TicketWithRelations } from '@/types'
import type {
  BrandingSettings,
  BurndownData,
  BurndownUnit,
  CompleteSprintInput,
  CreateLabelInput,
  CreateProjectInput,
  CreateSprintInput,
  CreateTicketInput,
  DashboardStats,
  DataProvider,
  ExtendSprintInput,
  MoveTicketInput,
  ProjectSummary,
  ProjectWithDetails,
  SearchTicketsParams,
  SprintSettings,
  StartSprintInput,
  UpdateLabelInput,
  UpdateProjectInput,
  UpdateSprintInput,
  UpdateTicketInput,
  UserSummary,
} from './types'

export class APIDataProvider implements DataProvider {
  readonly tabId: string

  constructor(tabId = '') {
    this.tabId = tabId
  }

  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.tabId && { 'X-Tab-Id': this.tabId }),
      ...options?.headers,
    }

    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async getProjects(): Promise<ProjectSummary[]> {
    return this.fetchJson('/api/projects')
  }

  async getProject(projectId: string): Promise<ProjectWithDetails | null> {
    try {
      return await this.fetchJson(`/api/projects/${projectId}`)
    } catch {
      return null
    }
  }

  async createProject(data: CreateProjectInput): Promise<ProjectSummary> {
    return this.fetchJson('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProject(projectId: string, data: UpdateProjectInput): Promise<ProjectSummary> {
    return this.fetchJson(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.fetchJson(`/api/projects/${projectId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // Columns
  // ============================================================================

  async getColumnsWithTickets(projectId: string): Promise<ColumnWithTickets[]> {
    return this.fetchJson(`/api/projects/${projectId}/columns`)
  }

  // ============================================================================
  // Tickets
  // ============================================================================

  async getTickets(projectId: string): Promise<TicketWithRelations[]> {
    return this.fetchJson(`/api/projects/${projectId}/tickets`)
  }

  async getTicket(projectId: string, ticketId: string): Promise<TicketWithRelations | null> {
    try {
      return await this.fetchJson(`/api/projects/${projectId}/tickets/${ticketId}`)
    } catch {
      return null
    }
  }

  async searchTickets(
    projectId: string,
    params: SearchTicketsParams,
  ): Promise<TicketWithRelations[]> {
    const searchParams = new URLSearchParams({ q: params.query })
    if (params.limit) {
      searchParams.set('limit', String(params.limit))
    }
    return this.fetchJson(`/api/projects/${projectId}/tickets/search?${searchParams.toString()}`)
  }

  async createTicket(projectId: string, data: CreateTicketInput): Promise<TicketWithRelations> {
    return this.fetchJson(`/api/projects/${projectId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTicket(
    projectId: string,
    ticketId: string,
    data: UpdateTicketInput,
  ): Promise<TicketWithRelations> {
    return this.fetchJson(`/api/projects/${projectId}/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteTicket(projectId: string, ticketId: string): Promise<void> {
    await this.fetchJson(`/api/projects/${projectId}/tickets/${ticketId}`, {
      method: 'DELETE',
    })
  }

  async moveTicket(
    projectId: string,
    ticketId: string,
    data: MoveTicketInput,
  ): Promise<TicketWithRelations> {
    return this.updateTicket(projectId, ticketId, data)
  }

  async moveTickets(
    projectId: string,
    ticketIds: string[],
    toColumnId: string,
    startOrder: number,
  ): Promise<TicketWithRelations[]> {
    return this.fetchJson(`/api/projects/${projectId}/tickets`, {
      method: 'PATCH',
      body: JSON.stringify({ ticketIds, toColumnId, newOrder: startOrder }),
    })
  }

  // ============================================================================
  // Labels
  // ============================================================================

  async getLabels(projectId: string): Promise<LabelSummary[]> {
    return this.fetchJson(`/api/projects/${projectId}/labels`)
  }

  async createLabel(projectId: string, data: CreateLabelInput): Promise<LabelSummary> {
    return this.fetchJson(`/api/projects/${projectId}/labels`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateLabel(
    projectId: string,
    labelId: string,
    data: UpdateLabelInput,
  ): Promise<LabelSummary> {
    return this.fetchJson(`/api/projects/${projectId}/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteLabel(projectId: string, labelId: string): Promise<void> {
    await this.fetchJson(`/api/projects/${projectId}/labels/${labelId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // Sprints
  // ============================================================================

  async getSprints(projectId: string): Promise<SprintSummary[]> {
    return this.fetchJson(`/api/projects/${projectId}/sprints`)
  }

  async getActiveSprint(projectId: string): Promise<SprintSummary | null> {
    try {
      return await this.fetchJson(`/api/projects/${projectId}/sprints/active`)
    } catch {
      return null
    }
  }

  async createSprint(projectId: string, data: CreateSprintInput): Promise<SprintSummary> {
    return this.fetchJson(`/api/projects/${projectId}/sprints`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateSprint(
    projectId: string,
    sprintId: string,
    data: UpdateSprintInput,
  ): Promise<SprintSummary> {
    return this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteSprint(projectId: string, sprintId: string): Promise<void> {
    await this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}`, {
      method: 'DELETE',
    })
  }

  async startSprint(
    projectId: string,
    sprintId: string,
    data: StartSprintInput,
  ): Promise<SprintSummary> {
    return this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async completeSprint(
    projectId: string,
    sprintId: string,
    data: CompleteSprintInput,
  ): Promise<SprintSummary> {
    // Convert DataProvider format to API format
    const actionMap: Record<string, string> = {
      backlog: 'close_to_backlog',
      carryover: 'close_to_next',
      keep: 'close_keep',
    }
    const apiData = {
      action: actionMap[data.incompleteAction] ?? 'close_to_backlog',
      targetSprintId: data.carryOverToSprintId ?? undefined,
    }
    return this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
      method: 'POST',
      body: JSON.stringify(apiData),
    })
  }

  async extendSprint(
    projectId: string,
    sprintId: string,
    data: ExtendSprintInput,
  ): Promise<SprintSummary> {
    return this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}/extend`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getSprintSettings(projectId: string): Promise<SprintSettings> {
    return this.fetchJson(`/api/projects/${projectId}/sprints/settings`)
  }

  async updateSprintSettings(
    projectId: string,
    data: Partial<SprintSettings>,
  ): Promise<SprintSettings> {
    return this.fetchJson(`/api/projects/${projectId}/sprints/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // ============================================================================
  // Burndown
  // ============================================================================

  async getBurndownData(
    projectId: string,
    sprintId: string,
    unit: BurndownUnit = 'points',
  ): Promise<BurndownData> {
    const params = unit === 'tickets' ? '?unit=tickets' : ''
    return this.fetchJson(`/api/projects/${projectId}/sprints/${sprintId}/burndown${params}`)
  }

  // ============================================================================
  // Members
  // ============================================================================

  async getProjectMembers(projectId: string): Promise<UserSummary[]> {
    const members = await this.fetchJson<Array<{ user: UserSummary }>>(
      `/api/projects/${projectId}/members`,
    )
    return members.map((m) => m.user)
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetchJson('/api/dashboard/stats')
  }

  // ============================================================================
  // Branding
  // ============================================================================

  async getBranding(): Promise<BrandingSettings> {
    return this.fetchJson('/api/branding')
  }
}
