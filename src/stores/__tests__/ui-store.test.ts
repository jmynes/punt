import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../ui-store'

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: true,
      mobileNavOpen: false,
      activeProjectId: null,
      createTicketOpen: false,
      createProjectOpen: false,
      prefillTicketData: null,
      activeTicketId: null,
    })
  })

  describe('Sidebar', () => {
    it('should toggle sidebar', () => {
      const initial = useUIStore.getState().sidebarOpen
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(!initial)
    })

    it('should set sidebar open state', () => {
      useUIStore.getState().setSidebarOpen(false)
      expect(useUIStore.getState().sidebarOpen).toBe(false)
    })
  })

  describe('Mobile Navigation', () => {
    it('should set mobile nav open state', () => {
      useUIStore.getState().setMobileNavOpen(true)
      expect(useUIStore.getState().mobileNavOpen).toBe(true)
    })
  })

  describe('Active Project', () => {
    it('should set active project ID', () => {
      useUIStore.getState().setActiveProjectId('project-1')
      expect(useUIStore.getState().activeProjectId).toBe('project-1')
    })

    it('should clear active project ID', () => {
      useUIStore.getState().setActiveProjectId('project-1')
      useUIStore.getState().setActiveProjectId(null)
      expect(useUIStore.getState().activeProjectId).toBeNull()
    })
  })

  describe('Modals', () => {
    it('should set create ticket open state', () => {
      useUIStore.getState().setCreateTicketOpen(true)
      expect(useUIStore.getState().createTicketOpen).toBe(true)
    })

    it('should set create project open state', () => {
      useUIStore.getState().setCreateProjectOpen(true)
      expect(useUIStore.getState().createProjectOpen).toBe(true)
    })
  })

  describe('Prefill Ticket Data', () => {
    it('should open create ticket with pre-filled data', () => {
      const data = { title: 'Test Ticket', type: 'task' as const }
      useUIStore.getState().openCreateTicketWithData(data)
      expect(useUIStore.getState().createTicketOpen).toBe(true)
      expect(useUIStore.getState().prefillTicketData).toEqual(data)
    })

    it('should clear prefill data', () => {
      useUIStore.getState().openCreateTicketWithData({ title: 'Test' })
      useUIStore.getState().clearPrefillData()
      expect(useUIStore.getState().prefillTicketData).toBeNull()
    })
  })

  describe('Active Ticket', () => {
    it('should set active ticket ID', () => {
      useUIStore.getState().setActiveTicketId('ticket-1')
      expect(useUIStore.getState().activeTicketId).toBe('ticket-1')
    })

    it('should clear active ticket ID', () => {
      useUIStore.getState().setActiveTicketId('ticket-1')
      useUIStore.getState().setActiveTicketId(null)
      expect(useUIStore.getState().activeTicketId).toBeNull()
    })
  })
})

