import { EventEmitter } from 'events'

/**
 * Event types for ticket operations
 */
export type TicketEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.deleted'
  | 'ticket.moved'

/**
 * Payload for ticket events
 */
export interface TicketEvent {
  type: TicketEventType
  projectId: string
  ticketId: string
  userId: string
  tabId?: string  // Optional tab ID for self-skip (when same user has multiple tabs)
  timestamp: number
}

/**
 * Project-scoped event emitter for real-time updates
 * Events are namespaced by project ID so clients only receive relevant updates
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
   * Subscribe to events for a specific project
   * Returns an unsubscribe function
   */
  subscribeToProject(projectId: string, callback: (event: TicketEvent) => void): () => void {
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
