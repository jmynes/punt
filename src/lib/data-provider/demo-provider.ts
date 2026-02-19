/**
 * Demo Data Provider
 *
 * Implementation of DataProvider that uses localStorage.
 * Used in demo mode for a fully client-side experience.
 */

import type { ColumnWithTickets, LabelSummary, SprintSummary, TicketWithRelations } from '@/types'
import { DEMO_TEAM_SUMMARIES, DEMO_USER_SUMMARY } from '../demo/demo-data'
import { demoStorage } from '../demo/demo-storage'
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

export class DemoDataProvider implements DataProvider {
  constructor() {
    // Ensure demo storage is initialized
    demoStorage.initialize()
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async getProjects(): Promise<ProjectSummary[]> {
    return demoStorage.getProjects()
  }

  async getProject(projectId: string): Promise<ProjectWithDetails | null> {
    const project = demoStorage.getProject(projectId)
    if (!project) return null
    return {
      ...project,
      role: 'owner',
    }
  }

  async createProject(data: CreateProjectInput): Promise<ProjectSummary> {
    return demoStorage.createProject(data)
  }

  async updateProject(projectId: string, data: UpdateProjectInput): Promise<ProjectSummary> {
    const updated = demoStorage.updateProject(projectId, data)
    if (!updated) throw new Error('Project not found')
    return updated
  }

  async deleteProject(projectId: string): Promise<void> {
    demoStorage.deleteProject(projectId)
  }

  // ============================================================================
  // Columns
  // ============================================================================

  async getColumnsWithTickets(projectId: string): Promise<ColumnWithTickets[]> {
    return demoStorage.getColumnsWithTickets(projectId)
  }

  // ============================================================================
  // Tickets
  // ============================================================================

  async getTickets(projectId: string): Promise<TicketWithRelations[]> {
    return demoStorage.getTickets(projectId)
  }

  async getTicket(projectId: string, ticketId: string): Promise<TicketWithRelations | null> {
    return demoStorage.getTicket(projectId, ticketId)
  }

  async searchTickets(
    projectId: string,
    params: SearchTicketsParams,
  ): Promise<TicketWithRelations[]> {
    const query = params.query.trim()
    const limit = params.limit ?? 20

    if (!query) return []

    const allTickets = demoStorage.getTickets(projectId)
    const queryLower = query.toLowerCase()

    // Check if query matches a ticket number
    const project = demoStorage.getProjects().find((p) => p.id === projectId)
    let ticketNumber: number | null = null
    if (project) {
      const keyPattern = new RegExp(`^${project.key}-(\\d+)$`, 'i')
      const keyMatch = query.match(keyPattern)
      if (keyMatch) {
        ticketNumber = Number.parseInt(keyMatch[1], 10)
      } else if (/^\d+$/.test(query)) {
        ticketNumber = Number.parseInt(query, 10)
      }
    }

    // Filter tickets that match the query
    const matchingTickets = allTickets.filter((ticket) => {
      if (ticketNumber !== null && ticket.number === ticketNumber) return true
      if (ticket.title.toLowerCase().includes(queryLower)) return true
      if (ticket.description?.toLowerCase().includes(queryLower)) return true
      return false
    })

    // Sort by relevance: exact key match first, then title, then description
    matchingTickets.sort((a, b) => {
      const aIsExactKey = ticketNumber !== null && a.number === ticketNumber
      const bIsExactKey = ticketNumber !== null && b.number === ticketNumber
      if (aIsExactKey && !bIsExactKey) return -1
      if (!aIsExactKey && bIsExactKey) return 1

      const aTitleMatch = a.title.toLowerCase().includes(queryLower)
      const bTitleMatch = b.title.toLowerCase().includes(queryLower)
      if (aTitleMatch && !bTitleMatch) return -1
      if (!aTitleMatch && bTitleMatch) return 1

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return matchingTickets.slice(0, limit)
  }

  async createTicket(projectId: string, data: CreateTicketInput): Promise<TicketWithRelations> {
    // Get labels if labelIds provided
    const labels = data.labelIds
      ? demoStorage.getLabels(projectId).filter((l) => data.labelIds?.includes(l.id))
      : []

    // Get sprint if sprintId provided
    const sprint = data.sprintId
      ? demoStorage.getSprints(projectId).find((s) => s.id === data.sprintId) || null
      : null

    // Get assignee if assigneeId provided
    const assignee = data.assigneeId
      ? [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES].find((u) => u.id === data.assigneeId) || null
      : null

    // Get reporter/creator if reporterId provided, default to demo user
    const allUsers = [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES]
    const creator = data.reporterId
      ? allUsers.find((u) => u.id === data.reporterId) || DEMO_USER_SUMMARY
      : DEMO_USER_SUMMARY

    return demoStorage.createTicket(projectId, data.columnId, {
      ...data,
      labels,
      sprint,
      assignee,
      creator,
    })
  }

  async updateTicket(
    projectId: string,
    ticketId: string,
    data: UpdateTicketInput,
  ): Promise<TicketWithRelations> {
    // Build the updates object (exclude reporterId from spread to avoid type conflicts)
    const { reporterId: _reporterId, ...restData } = data
    const updates: Partial<TicketWithRelations> = { ...restData }

    // Handle labels
    if (data.labelIds !== undefined) {
      updates.labels = demoStorage.getLabels(projectId).filter((l) => data.labelIds?.includes(l.id))
    }

    // Handle sprint
    if (data.sprintId !== undefined) {
      updates.sprint = data.sprintId
        ? demoStorage.getSprints(projectId).find((s) => s.id === data.sprintId) || null
        : null
    }

    // Handle assignee
    if (data.assigneeId !== undefined) {
      updates.assignee = data.assigneeId
        ? [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES].find((u) => u.id === data.assigneeId) || null
        : null
    }

    // Handle reporter/creator (API uses reporterId, internal uses creatorId)
    if (data.reporterId !== undefined && data.reporterId !== null) {
      const allUsers = [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES]
      updates.creatorId = data.reporterId
      updates.creator = allUsers.find((u) => u.id === data.reporterId) || DEMO_USER_SUMMARY
    }

    const updated = demoStorage.updateTicket(projectId, ticketId, updates)
    if (!updated) throw new Error('Ticket not found')
    return updated
  }

  async deleteTicket(projectId: string, ticketId: string): Promise<void> {
    demoStorage.deleteTicket(projectId, ticketId)
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
    const results: TicketWithRelations[] = []
    for (let i = 0; i < ticketIds.length; i++) {
      const updated = demoStorage.updateTicket(projectId, ticketIds[i], {
        columnId: toColumnId,
        order: startOrder + i,
      })
      if (updated) results.push(updated)
    }
    return results
  }

  // ============================================================================
  // Labels
  // ============================================================================

  async getLabels(projectId: string): Promise<LabelSummary[]> {
    return demoStorage.getLabels(projectId)
  }

  async createLabel(projectId: string, data: CreateLabelInput): Promise<LabelSummary> {
    return demoStorage.createLabel(projectId, data)
  }

  async updateLabel(
    projectId: string,
    labelId: string,
    data: UpdateLabelInput,
  ): Promise<LabelSummary> {
    const updated = demoStorage.updateLabel(projectId, labelId, data)
    if (!updated) throw new Error('Label not found')
    return updated
  }

  async deleteLabel(projectId: string, labelId: string): Promise<void> {
    demoStorage.deleteLabel(projectId, labelId)
  }

  // ============================================================================
  // Sprints
  // ============================================================================

  async getSprints(projectId: string): Promise<SprintSummary[]> {
    return demoStorage.getSprints(projectId)
  }

  async getActiveSprint(projectId: string): Promise<SprintSummary | null> {
    return demoStorage.getActiveSprint(projectId)
  }

  async createSprint(projectId: string, data: CreateSprintInput): Promise<SprintSummary> {
    return demoStorage.createSprint(projectId, data)
  }

  async updateSprint(
    projectId: string,
    sprintId: string,
    data: UpdateSprintInput,
  ): Promise<SprintSummary> {
    const updated = demoStorage.updateSprint(projectId, sprintId, data)
    if (!updated) throw new Error('Sprint not found')
    return updated
  }

  async deleteSprint(projectId: string, sprintId: string): Promise<void> {
    demoStorage.deleteSprint(projectId, sprintId)
  }

  async startSprint(
    projectId: string,
    sprintId: string,
    data: StartSprintInput,
  ): Promise<SprintSummary> {
    const sprint = demoStorage.getSprints(projectId).find((s) => s.id === sprintId)
    if (!sprint) throw new Error('Sprint not found')

    // Set dates if provided
    const startDate = data.startDate || new Date()
    const endDate = data.endDate || new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 2 weeks default

    const updated = demoStorage.updateSprint(projectId, sprintId, {
      status: 'active',
      startDate,
      endDate,
    })
    if (!updated) throw new Error('Sprint not found')
    return updated
  }

  async completeSprint(
    projectId: string,
    sprintId: string,
    data: CompleteSprintInput,
  ): Promise<SprintSummary> {
    const sprint = demoStorage.getSprints(projectId).find((s) => s.id === sprintId)
    if (!sprint) throw new Error('Sprint not found')

    // Handle incomplete tickets based on action
    const tickets = demoStorage.getTickets(projectId)
    const sprintTickets = tickets.filter((t) => t.sprintId === sprintId)
    const doneColumns = ['Done', 'Completed']

    // Track ticket disposition for the result
    const ticketDisposition = {
      completed: [] as string[],
      movedToBacklog: [] as string[],
      carriedOver: [] as string[],
    }

    for (const ticket of sprintTickets) {
      const column = demoStorage.getColumns(projectId).find((c) => c.id === ticket.columnId)
      const isComplete = column && doneColumns.includes(column.name)

      if (isComplete) {
        ticketDisposition.completed.push(ticket.id)
      } else if (data.incompleteAction === 'backlog') {
        demoStorage.updateTicket(projectId, ticket.id, {
          sprintId: null,
          sprint: null,
        })
        ticketDisposition.movedToBacklog.push(ticket.id)
      } else if (data.incompleteAction === 'carryover' && data.carryOverToSprintId) {
        const newSprint = demoStorage
          .getSprints(projectId)
          .find((s) => s.id === data.carryOverToSprintId)
        demoStorage.updateTicket(projectId, ticket.id, {
          sprintId: data.carryOverToSprintId,
          sprint: newSprint || null,
          isCarriedOver: true,
          carriedFromSprintId: sprintId,
          carriedOverCount: (ticket.carriedOverCount || 0) + 1,
        })
        ticketDisposition.carriedOver.push(ticket.id)
      }
      // 'keep' action: leave tickets in completed sprint
    }

    const updated = demoStorage.updateSprint(projectId, sprintId, {
      status: 'completed',
    })
    if (!updated) throw new Error('Sprint not found')

    // Return format compatible with SprintCompletionResult
    // The hook casts this to SprintCompletionResult which expects ticketDisposition
    return {
      ...updated,
      ticketDisposition,
    } as unknown as SprintSummary
  }

  async extendSprint(
    projectId: string,
    sprintId: string,
    data: ExtendSprintInput,
  ): Promise<SprintSummary> {
    const updated = demoStorage.updateSprint(projectId, sprintId, {
      endDate: data.newEndDate,
    })
    if (!updated) throw new Error('Sprint not found')
    return updated
  }

  async reopenSprint(projectId: string, sprintId: string): Promise<SprintSummary> {
    const sprint = demoStorage.getSprints(projectId).find((s) => s.id === sprintId)
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status !== 'completed') {
      throw new Error('Can only reopen a completed sprint')
    }

    // Check if there's already an active sprint
    const activeSprint = demoStorage.getActiveSprint(projectId)
    if (activeSprint) {
      throw new Error(
        `Another sprint "${activeSprint.name}" is already active. Complete it first before reopening this sprint.`,
      )
    }

    const updated = demoStorage.updateSprint(projectId, sprintId, {
      status: 'active',
    })
    if (!updated) throw new Error('Sprint not found')
    return updated
  }

  async getSprintSettings(_projectId: string): Promise<SprintSettings> {
    // Return default sprint settings for demo mode
    return {
      defaultSprintDuration: 14,
      autoCarryOverIncomplete: false,
      doneColumnIds: [],
    }
  }

  async updateSprintSettings(
    _projectId: string,
    data: Partial<SprintSettings>,
  ): Promise<SprintSettings> {
    // In demo mode, just return the merged settings (not persisted)
    return {
      defaultSprintDuration: data.defaultSprintDuration ?? 14,
      autoCarryOverIncomplete: data.autoCarryOverIncomplete ?? false,
      doneColumnIds: data.doneColumnIds ?? [],
    }
  }

  // ============================================================================
  // Burndown
  // ============================================================================

  async getBurndownData(
    _projectId: string,
    _sprintId: string,
    _unit?: BurndownUnit,
  ): Promise<BurndownData> {
    return {
      sprint: { id: '', name: '', startDate: '', endDate: null, status: '' },
      unit: 'points',
      dataPoints: [],
    }
  }

  // ============================================================================
  // Members
  // ============================================================================

  async getProjectMembers(_projectId: string): Promise<UserSummary[]> {
    return [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES]
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    const projects = demoStorage.getProjects()
    let openTickets = 0
    let inProgress = 0
    let completed = 0

    for (const project of projects) {
      const columns = demoStorage.getColumns(project.id)
      const tickets = demoStorage.getTickets(project.id)

      for (const column of columns) {
        const colName = column.name.toLowerCase()
        const columnTickets = tickets.filter((t) => t.columnId === column.id)

        if (colName === 'done' || colName === 'completed') {
          completed += columnTickets.length
        } else if (colName.includes('progress') || colName === 'in progress') {
          inProgress += columnTickets.length
        } else {
          openTickets += columnTickets.length
        }
      }
    }

    return { openTickets, inProgress, completed }
  }

  // ============================================================================
  // Branding
  // ============================================================================

  async getBranding(): Promise<BrandingSettings> {
    return {
      appName: 'PUNT',
      logoUrl: null,
      logoLetter: 'P',
      logoGradientFrom: '#f59e0b',
      logoGradientTo: '#ea580c',
    }
  }
}
