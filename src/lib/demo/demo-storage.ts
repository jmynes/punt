/**
 * Demo storage layer using localStorage
 *
 * Provides CRUD operations that mirror the API responses,
 * allowing the app to run entirely client-side in demo mode.
 */

import type {
  ColumnWithTickets,
  IssueType,
  LabelSummary,
  Priority,
  SprintSummary,
  TicketWithRelations,
} from '@/types'
import { DEMO_STORAGE_PREFIX, DEMO_TEAM_MEMBERS, DEMO_USER } from './demo-config'
import {
  DEMO_COLUMNS,
  DEMO_LABELS,
  DEMO_MEMBER,
  DEMO_PROJECTS,
  DEMO_ROLE,
  DEMO_SPRINTS,
  DEMO_TICKETS,
  DEMO_USER_SUMMARY,
  type DemoColumn,
  type DemoProject,
} from './demo-data'

// Storage keys
const KEYS = {
  initialized: `${DEMO_STORAGE_PREFIX}initialized`,
  projects: `${DEMO_STORAGE_PREFIX}projects`,
  columns: (projectId: string) => `${DEMO_STORAGE_PREFIX}columns-${projectId}`,
  tickets: (projectId: string) => `${DEMO_STORAGE_PREFIX}tickets-${projectId}`,
  labels: (projectId: string) => `${DEMO_STORAGE_PREFIX}labels-${projectId}`,
  sprints: (projectId: string) => `${DEMO_STORAGE_PREFIX}sprints-${projectId}`,
  ticketCounter: (projectId: string) => `${DEMO_STORAGE_PREFIX}ticket-counter-${projectId}`,
}

// Type for project summary (what useProjects returns)
export interface ProjectSummary {
  id: string
  name: string
  key: string
  description?: string | null
  color: string
  role: string
}

/**
 * Demo storage class for localStorage operations
 */
class DemoStorage {
  private isClient = typeof window !== 'undefined'

  /**
   * Initialize demo storage with seed data if not already initialized
   */
  initialize(): void {
    if (!this.isClient) return

    const initialized = localStorage.getItem(KEYS.initialized)
    if (initialized === 'true') {
      return
    }

    // Seed projects
    const projects: ProjectSummary[] = DEMO_PROJECTS.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      color: p.color,
      role: 'owner',
    }))
    localStorage.setItem(KEYS.projects, JSON.stringify(projects))

    // Seed columns, tickets, labels, sprints per project
    for (const project of DEMO_PROJECTS) {
      const projectColumns = DEMO_COLUMNS.filter((c) => c.projectId === project.id)
      localStorage.setItem(KEYS.columns(project.id), JSON.stringify(projectColumns))

      const projectTickets = DEMO_TICKETS.filter((t) => t.projectId === project.id)
      localStorage.setItem(KEYS.tickets(project.id), JSON.stringify(projectTickets))

      const projectLabels = DEMO_LABELS.filter((l) => l.projectId === project.id)
      localStorage.setItem(KEYS.labels(project.id), JSON.stringify(projectLabels))

      const projectSprints = DEMO_SPRINTS.filter((s) => s.projectId === project.id)
      localStorage.setItem(KEYS.sprints(project.id), JSON.stringify(projectSprints))

      // Set initial ticket counter
      const maxTicketNumber = Math.max(...projectTickets.map((t) => t.number), 0)
      localStorage.setItem(KEYS.ticketCounter(project.id), String(maxTicketNumber + 1))
    }

    localStorage.setItem(KEYS.initialized, 'true')
  }

  /**
   * Reset demo storage to initial state
   */
  reset(): void {
    if (!this.isClient) return

    // Clear all demo keys
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DEMO_STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    }

    // Re-initialize
    this.initialize()
  }

  // ============================================================================
  // Projects
  // ============================================================================

  getProjects(): ProjectSummary[] {
    if (!this.isClient) return []
    const data = localStorage.getItem(KEYS.projects)
    return data ? JSON.parse(data) : []
  }

  getProject(id: string): DemoProject | null {
    const projects = this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    return {
      ...project,
      description: project.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  createProject(data: {
    name: string
    key: string
    color: string
    description?: string
  }): ProjectSummary {
    const projects = this.getProjects()
    const newProject: ProjectSummary = {
      id: `demo-project-${Date.now()}`,
      name: data.name,
      key: data.key,
      color: data.color,
      description: data.description,
      role: 'owner',
    }
    projects.push(newProject)
    localStorage.setItem(KEYS.projects, JSON.stringify(projects))

    // Initialize empty columns, tickets, labels, sprints for new project
    const defaultColumns: DemoColumn[] = [
      { id: `demo-col-${Date.now()}-1`, name: 'To Do', order: 0, projectId: newProject.id },
      { id: `demo-col-${Date.now()}-2`, name: 'In Progress', order: 1, projectId: newProject.id },
      { id: `demo-col-${Date.now()}-3`, name: 'Review', order: 2, projectId: newProject.id },
      { id: `demo-col-${Date.now()}-4`, name: 'Done', order: 3, projectId: newProject.id },
    ]
    localStorage.setItem(KEYS.columns(newProject.id), JSON.stringify(defaultColumns))
    localStorage.setItem(KEYS.tickets(newProject.id), JSON.stringify([]))
    localStorage.setItem(KEYS.labels(newProject.id), JSON.stringify([]))
    localStorage.setItem(KEYS.sprints(newProject.id), JSON.stringify([]))
    localStorage.setItem(KEYS.ticketCounter(newProject.id), '1')

    return newProject
  }

  updateProject(
    id: string,
    data: { name?: string; key?: string; color?: string; description?: string | null },
  ): ProjectSummary | null {
    const projects = this.getProjects()
    const index = projects.findIndex((p) => p.id === id)
    if (index === -1) return null

    projects[index] = { ...projects[index], ...data }
    localStorage.setItem(KEYS.projects, JSON.stringify(projects))
    return projects[index]
  }

  deleteProject(id: string): void {
    const projects = this.getProjects().filter((p) => p.id !== id)
    localStorage.setItem(KEYS.projects, JSON.stringify(projects))

    // Clean up project-related data
    localStorage.removeItem(KEYS.columns(id))
    localStorage.removeItem(KEYS.tickets(id))
    localStorage.removeItem(KEYS.labels(id))
    localStorage.removeItem(KEYS.sprints(id))
    localStorage.removeItem(KEYS.ticketCounter(id))
  }

  // ============================================================================
  // Columns
  // ============================================================================

  getColumns(projectId: string): DemoColumn[] {
    if (!this.isClient) return []
    const data = localStorage.getItem(KEYS.columns(projectId))
    return data ? JSON.parse(data) : []
  }

  getColumnsWithTickets(projectId: string): ColumnWithTickets[] {
    const columns = this.getColumns(projectId)
    const tickets = this.getTickets(projectId)

    return columns.map((col) => ({
      id: col.id,
      name: col.name,
      icon: col.icon ?? null,
      color: col.color ?? null,
      order: col.order,
      projectId: col.projectId,
      tickets: tickets.filter((t) => t.columnId === col.id).sort((a, b) => a.order - b.order),
    }))
  }

  // ============================================================================
  // Tickets
  // ============================================================================

  getTickets(projectId: string): TicketWithRelations[] {
    if (!this.isClient) return []
    const data = localStorage.getItem(KEYS.tickets(projectId))
    if (!data) return []

    // Parse and revive dates
    const tickets: TicketWithRelations[] = JSON.parse(data)
    return tickets.map(this.reviveTicketDates)
  }

  getTicket(projectId: string, ticketId: string): TicketWithRelations | null {
    const tickets = this.getTickets(projectId)
    return tickets.find((t) => t.id === ticketId) || null
  }

  private getNextTicketNumber(projectId: string): number {
    const counter = localStorage.getItem(KEYS.ticketCounter(projectId))
    const num = counter ? Number.parseInt(counter, 10) : 1
    localStorage.setItem(KEYS.ticketCounter(projectId), String(num + 1))
    return num
  }

  createTicket(
    projectId: string,
    columnId: string,
    data: Partial<TicketWithRelations> & { title: string },
  ): TicketWithRelations {
    const tickets = this.getTickets(projectId)
    const ticketNumber = this.getNextTicketNumber(projectId)

    // Get the highest order in the column
    const columnTickets = tickets.filter((t) => t.columnId === columnId)
    const maxOrder = columnTickets.length > 0 ? Math.max(...columnTickets.map((t) => t.order)) : -1

    const newTicket: TicketWithRelations = {
      id: `demo-ticket-${Date.now()}`,
      number: ticketNumber,
      title: data.title,
      description: data.description ?? null,
      type: (data.type as IssueType) ?? 'task',
      priority: (data.priority as Priority) ?? 'medium',
      order: maxOrder + 1,
      storyPoints: data.storyPoints ?? null,
      estimate: data.estimate ?? null,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
      resolution: data.resolution ?? null,
      environment: data.environment ?? null,
      affectedVersion: data.affectedVersion ?? null,
      fixVersion: data.fixVersion ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId,
      columnId,
      assigneeId: data.assigneeId ?? null,
      creatorId: data.creator?.id ?? DEMO_USER.id,
      sprintId: data.sprintId ?? null,
      parentId: data.parentId ?? null,
      isCarriedOver: false,
      carriedFromSprintId: null,
      carriedOverCount: 0,
      assignee: data.assignee ?? null,
      creator: data.creator ?? DEMO_USER_SUMMARY,
      sprint: data.sprint ?? null,
      carriedFromSprint: null,
      labels: data.labels ?? [],
      watchers: data.watchers ?? [],
    }

    tickets.push(newTicket)
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))

    return newTicket
  }

  updateTicket(
    projectId: string,
    ticketId: string,
    updates: Partial<TicketWithRelations>,
  ): TicketWithRelations | null {
    const tickets = this.getTickets(projectId)
    const index = tickets.findIndex((t) => t.id === ticketId)
    if (index === -1) return null

    tickets[index] = {
      ...tickets[index],
      ...updates,
      updatedAt: new Date(),
    }
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))

    return tickets[index]
  }

  deleteTicket(projectId: string, ticketId: string): void {
    const tickets = this.getTickets(projectId).filter((t) => t.id !== ticketId)
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))
  }

  syncTickets(projectId: string, tickets: TicketWithRelations[]): void {
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))
  }

  // Helper to revive date strings to Date objects
  private reviveTicketDates(ticket: TicketWithRelations): TicketWithRelations {
    return {
      ...ticket,
      startDate: ticket.startDate ? new Date(ticket.startDate) : null,
      dueDate: ticket.dueDate ? new Date(ticket.dueDate) : null,
      createdAt: new Date(ticket.createdAt),
      updatedAt: new Date(ticket.updatedAt),
      sprint: ticket.sprint
        ? {
            ...ticket.sprint,
            startDate: ticket.sprint.startDate ? new Date(ticket.sprint.startDate) : null,
            endDate: ticket.sprint.endDate ? new Date(ticket.sprint.endDate) : null,
          }
        : null,
      carriedFromSprint: ticket.carriedFromSprint
        ? {
            ...ticket.carriedFromSprint,
            startDate: ticket.carriedFromSprint.startDate
              ? new Date(ticket.carriedFromSprint.startDate)
              : null,
            endDate: ticket.carriedFromSprint.endDate
              ? new Date(ticket.carriedFromSprint.endDate)
              : null,
          }
        : null,
    }
  }

  // ============================================================================
  // Labels
  // ============================================================================

  getLabels(projectId: string): LabelSummary[] {
    if (!this.isClient) return []
    const data = localStorage.getItem(KEYS.labels(projectId))
    return data ? JSON.parse(data) : []
  }

  createLabel(projectId: string, data: { name: string; color?: string }): LabelSummary {
    const labels = this.getLabels(projectId)

    // Check for existing label with same name (case-insensitive)
    const existing = labels.find((l) => l.name.toLowerCase() === data.name.toLowerCase())
    if (existing) return existing

    const newLabel: LabelSummary = {
      id: `demo-label-${Date.now()}`,
      name: data.name,
      color: data.color ?? this.generateLabelColor(),
    }
    labels.push(newLabel)
    localStorage.setItem(KEYS.labels(projectId), JSON.stringify(labels))

    return newLabel
  }

  updateLabel(
    projectId: string,
    labelId: string,
    data: { name?: string; color?: string },
  ): LabelSummary | null {
    const labels = this.getLabels(projectId)
    const index = labels.findIndex((l) => l.id === labelId)
    if (index === -1) return null

    labels[index] = { ...labels[index], ...data }
    localStorage.setItem(KEYS.labels(projectId), JSON.stringify(labels))

    // Update label in all tickets that use it
    const tickets = this.getTickets(projectId)
    for (const ticket of tickets) {
      const labelIndex = ticket.labels.findIndex((l) => l.id === labelId)
      if (labelIndex !== -1) {
        ticket.labels[labelIndex] = { ...ticket.labels[labelIndex], ...data }
      }
    }
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))

    return labels[index]
  }

  deleteLabel(projectId: string, labelId: string): void {
    const labels = this.getLabels(projectId).filter((l) => l.id !== labelId)
    localStorage.setItem(KEYS.labels(projectId), JSON.stringify(labels))

    // Remove label from all tickets
    const tickets = this.getTickets(projectId)
    for (const ticket of tickets) {
      ticket.labels = ticket.labels.filter((l) => l.id !== labelId)
    }
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))
  }

  private generateLabelColor(): string {
    const colors = [
      '#ef4444',
      '#f59e0b',
      '#22c55e',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // ============================================================================
  // Sprints
  // ============================================================================

  getSprints(projectId: string): SprintSummary[] {
    if (!this.isClient) return []
    const data = localStorage.getItem(KEYS.sprints(projectId))
    if (!data) return []

    const sprints: SprintSummary[] = JSON.parse(data)
    return sprints.map((s) => ({
      ...s,
      startDate: s.startDate ? new Date(s.startDate) : null,
      endDate: s.endDate ? new Date(s.endDate) : null,
    }))
  }

  getActiveSprint(projectId: string): SprintSummary | null {
    const sprints = this.getSprints(projectId)
    return sprints.find((s) => s.status === 'active') || null
  }

  createSprint(
    projectId: string,
    data: { name: string; goal?: string; startDate?: Date; endDate?: Date; budget?: number | null },
  ): SprintSummary {
    const sprints = this.getSprints(projectId)

    const newSprint: SprintSummary = {
      id: `demo-sprint-${Date.now()}`,
      name: data.name,
      status: 'planning',
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      goal: data.goal ?? null,
      budget: data.budget ?? null,
    }
    sprints.push(newSprint)
    localStorage.setItem(KEYS.sprints(projectId), JSON.stringify(sprints))

    return newSprint
  }

  updateSprint(
    projectId: string,
    sprintId: string,
    updates: Partial<SprintSummary>,
  ): SprintSummary | null {
    const sprints = this.getSprints(projectId)
    const index = sprints.findIndex((s) => s.id === sprintId)
    if (index === -1) return null

    sprints[index] = { ...sprints[index], ...updates }
    localStorage.setItem(KEYS.sprints(projectId), JSON.stringify(sprints))

    return sprints[index]
  }

  deleteSprint(projectId: string, sprintId: string): void {
    const sprints = this.getSprints(projectId).filter((s) => s.id !== sprintId)
    localStorage.setItem(KEYS.sprints(projectId), JSON.stringify(sprints))

    // Remove sprint from all tickets
    const tickets = this.getTickets(projectId)
    for (const ticket of tickets) {
      if (ticket.sprintId === sprintId) {
        ticket.sprintId = null
        ticket.sprint = null
      }
    }
    localStorage.setItem(KEYS.tickets(projectId), JSON.stringify(tickets))
  }

  // ============================================================================
  // Members (demo mode only has the demo user)
  // ============================================================================

  getMembers(_projectId: string) {
    return [DEMO_MEMBER]
  }

  // ============================================================================
  // Roles (demo mode has a single owner role)
  // ============================================================================

  getRoles(_projectId: string) {
    return [DEMO_ROLE]
  }

  // ============================================================================
  // Users (for admin panel)
  // ============================================================================

  getUsers(): DemoAdminUser[] {
    // Return demo user and team members
    const allUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
    return allUsers.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isSystemAdmin: user.isSystemAdmin,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.id === DEMO_USER.id ? new Date().toISOString() : null,
      _count: { projects: 2 },
    }))
  }
}

// Type for admin user list
export interface DemoAdminUser {
  id: string
  username: string
  name: string
  email: string
  avatar: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  _count: { projects: number }
}

export const demoStorage = new DemoStorage()
