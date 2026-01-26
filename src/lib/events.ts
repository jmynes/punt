import { EventEmitter } from 'node:events'

// Connection limit constants
const MAX_CONNECTIONS_PER_USER = 10
const MAX_CONNECTIONS_PER_PROJECT = 100

/**
 * Event types for ticket operations
 */
export type TicketEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.deleted'
  | 'ticket.moved'

/**
 * Event types for project operations
 */
export type ProjectEventType = 'project.created' | 'project.updated' | 'project.deleted'

/**
 * Event types for label operations
 */
export type LabelEventType = 'label.created' | 'label.updated' | 'label.deleted'

/**
 * Event types for sprint operations
 */
export type SprintEventType =
  | 'sprint.created'
  | 'sprint.updated'
  | 'sprint.deleted'
  | 'sprint.started'
  | 'sprint.completed'

/**
 * Event types for user profile operations
 */
export type UserEventType = 'user.updated'

/**
 * Event types for branding operations
 */
export type BrandingEventType = 'branding.updated'

/**
 * Event types for settings operations
 */
export type SettingsEventType = 'settings.roles.updated'

/**
 * Event types for member operations
 */
export type MemberEventType = 'member.role.updated'

/**
 * Payload for ticket events
 */
export interface TicketEvent {
  type: TicketEventType
  projectId: string
  ticketId: string
  userId: string
  tabId?: string // Optional tab ID for self-skip (when same user has multiple tabs)
  timestamp: number
}

/**
 * Payload for project events
 */
export interface ProjectEvent {
  type: ProjectEventType
  projectId: string
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
}

/**
 * Payload for label events
 */
export interface LabelEvent {
  type: LabelEventType
  projectId: string
  labelId: string
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
}

/**
 * Payload for sprint events
 */
export interface SprintEvent {
  type: SprintEventType
  projectId: string
  sprintId: string
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
}

/**
 * Payload for user profile events
 */
export interface UserEvent {
  type: UserEventType
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
  changes?: {
    name?: string
    avatar?: string | null
    isSystemAdmin?: boolean
    isActive?: boolean
  }
}

/**
 * Payload for branding events
 */
export interface BrandingEvent {
  type: BrandingEventType
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
}

/**
 * Payload for settings events
 */
export interface SettingsEvent {
  type: SettingsEventType
  userId: string
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
}

/**
 * Payload for member events
 */
export interface MemberEvent {
  type: MemberEventType
  memberId: string
  targetUserId: string // The user whose role changed
  projectId: string
  userId: string // The user who made the change
  tabId?: string // Optional tab ID for self-skip
  timestamp: number
  changes?: {
    roleId?: string
    roleName?: string
    previousRoleId?: string
    previousRoleName?: string
  }
}

// Global channel for project-level events (visible to all authenticated users)
const PROJECTS_GLOBAL_CHANNEL = 'projects:global'
// Global channel for user profile events (visible to all authenticated users)
const USERS_GLOBAL_CHANNEL = 'users:global'
// Global channel for branding events (visible to all authenticated users)
const BRANDING_GLOBAL_CHANNEL = 'branding:global'
// Global channel for settings events (visible to all authenticated users)
const SETTINGS_GLOBAL_CHANNEL = 'settings:global'
// Global channel for member events (visible to all authenticated users)
const MEMBERS_GLOBAL_CHANNEL = 'members:global'

/**
 * Event emitter for real-time updates
 * - Ticket events are namespaced by project ID so clients only receive relevant updates
 * - Project events use a global channel since all users need to see project list changes
 */
class ProjectEventEmitter extends EventEmitter {
  private userConnectionCounts: Map<string, number> = new Map()
  private projectConnectionCounts: Map<string, number> = new Map()

  constructor() {
    super()
    // Allow many listeners (one per connected client)
    this.setMaxListeners(1000)
  }

  /**
   * Check if a user can open a new connection
   */
  canUserConnect(userId: string): boolean {
    const count = this.userConnectionCounts.get(userId) || 0
    return count < MAX_CONNECTIONS_PER_USER
  }

  /**
   * Check if a project can accept a new connection
   */
  canProjectAcceptConnection(projectId: string): boolean {
    const count = this.projectConnectionCounts.get(projectId) || 0
    return count < MAX_CONNECTIONS_PER_PROJECT
  }

  /**
   * Track a new connection and return a cleanup function
   */
  trackConnection(userId: string, projectId: string): () => void {
    // Increment counts
    this.userConnectionCounts.set(userId, (this.userConnectionCounts.get(userId) || 0) + 1)
    this.projectConnectionCounts.set(
      projectId,
      (this.projectConnectionCounts.get(projectId) || 0) + 1,
    )

    // Return cleanup function
    return () => {
      const userCount = this.userConnectionCounts.get(userId) || 1
      this.userConnectionCounts.set(userId, Math.max(0, userCount - 1))

      const projectCount = this.projectConnectionCounts.get(projectId) || 1
      this.projectConnectionCounts.set(projectId, Math.max(0, projectCount - 1))
    }
  }

  /**
   * Emit a ticket event to all subscribers of a project
   */
  emitTicketEvent(event: TicketEvent) {
    this.emit(`project:${event.projectId}`, event)
  }

  /**
   * Emit a label event to all subscribers of a project
   */
  emitLabelEvent(event: LabelEvent) {
    this.emit(`project:${event.projectId}`, event)
  }

  /**
   * Emit a sprint event to all subscribers of a project
   */
  emitSprintEvent(event: SprintEvent) {
    this.emit(`project:${event.projectId}`, event)
  }

  /**
   * Subscribe to events for a specific project (tickets, labels, and sprints)
   * Returns an unsubscribe function
   */
  subscribeToProject(
    projectId: string,
    callback: (event: TicketEvent | LabelEvent | SprintEvent) => void,
  ): () => void {
    const eventName = `project:${projectId}`
    this.on(eventName, callback)
    return () => this.off(eventName, callback)
  }

  /**
   * Get the number of listeners for a project
   */
  getProjectListenerCount(projectId: string): number {
    return this.listenerCount(`project:${projectId}`)
  }

  /**
   * Emit a project event to all subscribers (global channel)
   */
  emitProjectEvent(event: ProjectEvent) {
    this.emit(PROJECTS_GLOBAL_CHANNEL, event)
  }

  /**
   * Subscribe to global project events (create, update, delete)
   * Returns an unsubscribe function
   */
  subscribeToProjects(callback: (event: ProjectEvent) => void): () => void {
    this.on(PROJECTS_GLOBAL_CHANNEL, callback)
    return () => this.off(PROJECTS_GLOBAL_CHANNEL, callback)
  }

  /**
   * Get the number of listeners for global project events
   */
  getProjectsListenerCount(): number {
    return this.listenerCount(PROJECTS_GLOBAL_CHANNEL)
  }

  /**
   * Emit a user profile event to all subscribers (global channel)
   */
  emitUserEvent(event: UserEvent) {
    this.emit(USERS_GLOBAL_CHANNEL, event)
  }

  /**
   * Subscribe to global user profile events
   * Returns an unsubscribe function
   */
  subscribeToUsers(callback: (event: UserEvent) => void): () => void {
    this.on(USERS_GLOBAL_CHANNEL, callback)
    return () => this.off(USERS_GLOBAL_CHANNEL, callback)
  }

  /**
   * Get the number of listeners for global user events
   */
  getUsersListenerCount(): number {
    return this.listenerCount(USERS_GLOBAL_CHANNEL)
  }

  /**
   * Emit a branding event to all subscribers (global channel)
   */
  emitBrandingEvent(event: BrandingEvent) {
    this.emit(BRANDING_GLOBAL_CHANNEL, event)
  }

  /**
   * Subscribe to global branding events
   * Returns an unsubscribe function
   */
  subscribeToBranding(callback: (event: BrandingEvent) => void): () => void {
    this.on(BRANDING_GLOBAL_CHANNEL, callback)
    return () => this.off(BRANDING_GLOBAL_CHANNEL, callback)
  }

  /**
   * Get the number of listeners for global branding events
   */
  getBrandingListenerCount(): number {
    return this.listenerCount(BRANDING_GLOBAL_CHANNEL)
  }

  /**
   * Emit a settings event to all subscribers (global channel)
   */
  emitSettingsEvent(event: SettingsEvent) {
    this.emit(SETTINGS_GLOBAL_CHANNEL, event)
  }

  /**
   * Subscribe to global settings events
   * Returns an unsubscribe function
   */
  subscribeToSettings(callback: (event: SettingsEvent) => void): () => void {
    this.on(SETTINGS_GLOBAL_CHANNEL, callback)
    return () => this.off(SETTINGS_GLOBAL_CHANNEL, callback)
  }

  /**
   * Get the number of listeners for global settings events
   */
  getSettingsListenerCount(): number {
    return this.listenerCount(SETTINGS_GLOBAL_CHANNEL)
  }

  /**
   * Emit a member event to all subscribers (global channel)
   */
  emitMemberEvent(event: MemberEvent) {
    this.emit(MEMBERS_GLOBAL_CHANNEL, event)
  }

  /**
   * Subscribe to global member events
   * Returns an unsubscribe function
   */
  subscribeToMembers(callback: (event: MemberEvent) => void): () => void {
    this.on(MEMBERS_GLOBAL_CHANNEL, callback)
    return () => this.off(MEMBERS_GLOBAL_CHANNEL, callback)
  }

  /**
   * Get the number of listeners for global member events
   */
  getMembersListenerCount(): number {
    return this.listenerCount(MEMBERS_GLOBAL_CHANNEL)
  }
}

// Use globalThis to ensure singleton across module reloads in Next.js
// This pattern ensures the same EventEmitter instance is used across all API routes
const globalForEvents = globalThis as unknown as {
  projectEvents: ProjectEventEmitter | undefined
}

// Always store in globalThis to ensure singleton across different module loads
if (!globalForEvents.projectEvents) {
  globalForEvents.projectEvents = new ProjectEventEmitter()
}

export const projectEvents = globalForEvents.projectEvents
