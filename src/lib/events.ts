import { EventEmitter } from 'node:events'

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

// Global channel for project-level events (visible to all authenticated users)
const PROJECTS_GLOBAL_CHANNEL = 'projects:global'

/**
 * Event emitter for real-time updates
 * - Ticket events are namespaced by project ID so clients only receive relevant updates
 * - Project events use a global channel since all users need to see project list changes
 */
class ProjectEventEmitter extends EventEmitter {
  constructor() {
    super()
    // Allow many listeners (one per connected client)
    this.setMaxListeners(1000)
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
   * Subscribe to events for a specific project (tickets and labels)
   * Returns an unsubscribe function
   */
  subscribeToProject(
    projectId: string,
    callback: (event: TicketEvent | LabelEvent) => void,
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
