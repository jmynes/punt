import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../ui-store'

// Helper to reset store state to defaults
function resetStore() {
  useUIStore.setState({
    sidebarOpen: true,
    mobileNavOpen: false,
    activeProjectId: null,
    createTicketOpen: false,
    createProjectOpen: false,
    editProjectOpen: false,
    editProjectId: null,
    sprintCreateOpen: false,
    sprintEditOpen: false,
    sprintEditId: null,
    sprintCompleteOpen: false,
    sprintCompleteId: null,
    sprintStartOpen: false,
    sprintStartId: null,
    prefillTicketData: null,
    activeTicketId: null,
    drawerFocusField: null,
  })
}

describe('UI Store', () => {
  beforeEach(() => {
    resetStore()
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

    it('should clear drawer focus field when setting active ticket', () => {
      useUIStore.getState().openTicketWithFocus('ticket-1', 'description')
      useUIStore.getState().setActiveTicketId('ticket-2')
      expect(useUIStore.getState().activeTicketId).toBe('ticket-2')
      expect(useUIStore.getState().drawerFocusField).toBeNull()
    })
  })

  describe('Edit Project Modal', () => {
    it('should default to closed with no project', () => {
      expect(useUIStore.getState().editProjectOpen).toBe(false)
      expect(useUIStore.getState().editProjectId).toBeNull()
    })

    it('should open edit project modal with project id', () => {
      useUIStore.getState().openEditProject('project-1')
      expect(useUIStore.getState().editProjectOpen).toBe(true)
      expect(useUIStore.getState().editProjectId).toBe('project-1')
    })

    it('should close edit project modal and clear project id', () => {
      useUIStore.getState().openEditProject('project-1')
      useUIStore.getState().closeEditProject()
      expect(useUIStore.getState().editProjectOpen).toBe(false)
      expect(useUIStore.getState().editProjectId).toBeNull()
    })
  })

  describe('Sprint Create Modal', () => {
    it('should default to closed', () => {
      expect(useUIStore.getState().sprintCreateOpen).toBe(false)
    })

    it('should open sprint create modal', () => {
      useUIStore.getState().setSprintCreateOpen(true)
      expect(useUIStore.getState().sprintCreateOpen).toBe(true)
    })

    it('should close sprint create modal', () => {
      useUIStore.getState().setSprintCreateOpen(true)
      useUIStore.getState().setSprintCreateOpen(false)
      expect(useUIStore.getState().sprintCreateOpen).toBe(false)
    })
  })

  describe('Sprint Edit Modal', () => {
    it('should default to closed with no sprint', () => {
      expect(useUIStore.getState().sprintEditOpen).toBe(false)
      expect(useUIStore.getState().sprintEditId).toBeNull()
    })

    it('should open sprint edit modal with sprint id', () => {
      useUIStore.getState().openSprintEdit('sprint-1')
      expect(useUIStore.getState().sprintEditOpen).toBe(true)
      expect(useUIStore.getState().sprintEditId).toBe('sprint-1')
    })

    it('should close sprint edit modal and clear sprint id', () => {
      useUIStore.getState().openSprintEdit('sprint-1')
      useUIStore.getState().closeSprintEdit()
      expect(useUIStore.getState().sprintEditOpen).toBe(false)
      expect(useUIStore.getState().sprintEditId).toBeNull()
    })
  })

  describe('Sprint Complete Modal', () => {
    it('should default to closed with no sprint', () => {
      expect(useUIStore.getState().sprintCompleteOpen).toBe(false)
      expect(useUIStore.getState().sprintCompleteId).toBeNull()
    })

    it('should open sprint complete modal with sprint id', () => {
      useUIStore.getState().openSprintComplete('sprint-1')
      expect(useUIStore.getState().sprintCompleteOpen).toBe(true)
      expect(useUIStore.getState().sprintCompleteId).toBe('sprint-1')
    })

    it('should close sprint complete modal and clear sprint id', () => {
      useUIStore.getState().openSprintComplete('sprint-1')
      useUIStore.getState().closeSprintComplete()
      expect(useUIStore.getState().sprintCompleteOpen).toBe(false)
      expect(useUIStore.getState().sprintCompleteId).toBeNull()
    })
  })

  describe('Sprint Start Modal', () => {
    it('should default to closed with no sprint', () => {
      expect(useUIStore.getState().sprintStartOpen).toBe(false)
      expect(useUIStore.getState().sprintStartId).toBeNull()
    })

    it('should open sprint start modal with sprint id', () => {
      useUIStore.getState().openSprintStart('sprint-1')
      expect(useUIStore.getState().sprintStartOpen).toBe(true)
      expect(useUIStore.getState().sprintStartId).toBe('sprint-1')
    })

    it('should close sprint start modal and clear sprint id', () => {
      useUIStore.getState().openSprintStart('sprint-1')
      useUIStore.getState().closeSprintStart()
      expect(useUIStore.getState().sprintStartOpen).toBe(false)
      expect(useUIStore.getState().sprintStartId).toBeNull()
    })
  })

  describe('Drawer Focus Field', () => {
    it('should default to null', () => {
      expect(useUIStore.getState().drawerFocusField).toBeNull()
    })

    it('should open ticket with focus on specific field', () => {
      useUIStore.getState().openTicketWithFocus('ticket-1', 'description')
      expect(useUIStore.getState().activeTicketId).toBe('ticket-1')
      expect(useUIStore.getState().drawerFocusField).toBe('description')
    })

    it('should clear drawer focus field', () => {
      useUIStore.getState().openTicketWithFocus('ticket-1', 'description')
      useUIStore.getState().clearDrawerFocusField()
      expect(useUIStore.getState().drawerFocusField).toBeNull()
      expect(useUIStore.getState().activeTicketId).toBe('ticket-1')
    })
  })

  describe('Combined Operations', () => {
    it('should handle multiple modals being opened in sequence', () => {
      useUIStore.getState().setCreateTicketOpen(true)
      useUIStore.getState().setCreateProjectOpen(true)
      useUIStore.getState().openEditProject('project-1')

      expect(useUIStore.getState().createTicketOpen).toBe(true)
      expect(useUIStore.getState().createProjectOpen).toBe(true)
      expect(useUIStore.getState().editProjectOpen).toBe(true)
    })

    it('should handle switching between sprint modals', () => {
      useUIStore.getState().openSprintStart('sprint-1')
      expect(useUIStore.getState().sprintStartOpen).toBe(true)

      useUIStore.getState().closeSprintStart()
      useUIStore.getState().openSprintComplete('sprint-1')
      expect(useUIStore.getState().sprintStartOpen).toBe(false)
      expect(useUIStore.getState().sprintCompleteOpen).toBe(true)
    })
  })
})
