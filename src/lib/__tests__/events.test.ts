/**
 * Tests for the real-time events system
 */

import { describe, expect, it, vi } from 'vitest'
import { type DatabaseEvent, type ProjectEvent, projectEvents } from '@/lib/events'

describe('Events System', () => {
  describe('Project Events', () => {
    it('should emit and receive project events', () => {
      const callback = vi.fn()
      const unsubscribe = projectEvents.subscribeToProjects(callback)

      const event: ProjectEvent = {
        type: 'project.created',
        projectId: 'test-project',
        userId: 'test-user',
        timestamp: Date.now(),
      }

      projectEvents.emitProjectEvent(event)

      expect(callback).toHaveBeenCalledWith(event)
      unsubscribe()
    })

    it('should not receive events after unsubscribe', () => {
      const callback = vi.fn()
      const unsubscribe = projectEvents.subscribeToProjects(callback)

      unsubscribe()

      projectEvents.emitProjectEvent({
        type: 'project.deleted',
        projectId: 'test-project',
        userId: 'test-user',
        timestamp: Date.now(),
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Database Events', () => {
    it('should emit and receive database.wiped events', () => {
      const callback = vi.fn()
      const unsubscribe = projectEvents.subscribeToDatabase(callback)

      const event: DatabaseEvent = {
        type: 'database.wiped',
        userId: 'admin-user',
        timestamp: Date.now(),
      }

      projectEvents.emitDatabaseEvent(event)

      expect(callback).toHaveBeenCalledWith(event)
      expect(callback).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('should emit and receive database.projects.wiped events', () => {
      const callback = vi.fn()
      const unsubscribe = projectEvents.subscribeToDatabase(callback)

      const event: DatabaseEvent = {
        type: 'database.projects.wiped',
        userId: 'admin-user',
        timestamp: Date.now(),
      }

      projectEvents.emitDatabaseEvent(event)

      expect(callback).toHaveBeenCalledWith(event)
      unsubscribe()
    })

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      const unsubscribe1 = projectEvents.subscribeToDatabase(callback1)
      const unsubscribe2 = projectEvents.subscribeToDatabase(callback2)

      const event: DatabaseEvent = {
        type: 'database.wiped',
        userId: 'admin-user',
        timestamp: Date.now(),
      }

      projectEvents.emitDatabaseEvent(event)

      expect(callback1).toHaveBeenCalledWith(event)
      expect(callback2).toHaveBeenCalledWith(event)

      unsubscribe1()
      unsubscribe2()
    })

    it('should include tabId when provided', () => {
      const callback = vi.fn()
      const unsubscribe = projectEvents.subscribeToDatabase(callback)

      const event: DatabaseEvent = {
        type: 'database.projects.wiped',
        userId: 'admin-user',
        tabId: 'tab-123',
        timestamp: Date.now(),
      }

      projectEvents.emitDatabaseEvent(event)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 'tab-123',
        }),
      )
      unsubscribe()
    })
  })

  describe('Listener Counts', () => {
    it('should track database listener count', () => {
      const initialCount = projectEvents.getDatabaseListenerCount()

      const unsubscribe1 = projectEvents.subscribeToDatabase(() => {})
      expect(projectEvents.getDatabaseListenerCount()).toBe(initialCount + 1)

      const unsubscribe2 = projectEvents.subscribeToDatabase(() => {})
      expect(projectEvents.getDatabaseListenerCount()).toBe(initialCount + 2)

      unsubscribe1()
      expect(projectEvents.getDatabaseListenerCount()).toBe(initialCount + 1)

      unsubscribe2()
      expect(projectEvents.getDatabaseListenerCount()).toBe(initialCount)
    })
  })
})
