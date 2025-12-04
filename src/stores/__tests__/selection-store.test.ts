import { beforeEach, describe, expect, it } from 'vitest'
import { useSelectionStore } from '../selection-store'

describe('Selection Store', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedTicketIds: new Set(),
      lastSelectedId: null,
    })
  })

  describe('selectTicket', () => {
    it('should select a single ticket and clear others', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
      expect(useSelectionStore.getState().getSelectedIds()).toEqual(['ticket-1'])
      expect(useSelectionStore.getState().lastSelectedId).toBe('ticket-1')
    })

    it('should replace existing selection', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().selectTicket('ticket-2')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(false)
      expect(useSelectionStore.getState().isSelected('ticket-2')).toBe(true)
    })
  })

  describe('toggleTicket', () => {
    it('should add ticket to selection if not selected', () => {
      useSelectionStore.getState().toggleTicket('ticket-1')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
    })

    it('should remove ticket from selection if already selected', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().toggleTicket('ticket-1')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(false)
    })

    it('should preserve other selections when toggling', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().toggleTicket('ticket-2')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-2')).toBe(true)
    })
  })

  describe('selectRange', () => {
    it('should select single ticket if no last selected', () => {
      const allIds = ['ticket-1', 'ticket-2', 'ticket-3']
      useSelectionStore.getState().selectRange('ticket-2', allIds)
      expect(useSelectionStore.getState().isSelected('ticket-2')).toBe(true)
      expect(useSelectionStore.getState().getSelectedIds()).toEqual(['ticket-2'])
    })

    it('should select range from last selected to current', () => {
      const allIds = ['ticket-1', 'ticket-2', 'ticket-3', 'ticket-4']
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().selectRange('ticket-3', allIds)
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-2')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-3')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-4')).toBe(false)
    })

    it('should select range backwards', () => {
      const allIds = ['ticket-1', 'ticket-2', 'ticket-3']
      useSelectionStore.getState().selectTicket('ticket-3')
      useSelectionStore.getState().selectRange('ticket-1', allIds)
      expect(useSelectionStore.getState().getSelectedIds().sort()).toEqual([
        'ticket-1',
        'ticket-2',
        'ticket-3',
      ])
    })

    it('should merge with existing selection', () => {
      const allIds = ['ticket-1', 'ticket-2', 'ticket-3', 'ticket-4']
      // First select ticket-4
      useSelectionStore.getState().toggleTicket('ticket-4')
      // Then select ticket-1 (this clears selection and selects only ticket-1)
      useSelectionStore.getState().selectTicket('ticket-1')
      // Then select range from ticket-1 to ticket-2 (should include ticket-1, ticket-2)
      useSelectionStore.getState().selectRange('ticket-2', allIds)
      // ticket-4 was cleared when we called selectTicket, so it should not be selected
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-2')).toBe(true)
      expect(useSelectionStore.getState().isSelected('ticket-4')).toBe(false)
    })
  })

  describe('addToSelection', () => {
    it('should add multiple tickets to selection', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().addToSelection(['ticket-2', 'ticket-3'])
      expect(useSelectionStore.getState().getSelectedIds().sort()).toEqual([
        'ticket-1',
        'ticket-2',
        'ticket-3',
      ])
    })
  })

  describe('clearSelection', () => {
    it('should clear all selections', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().toggleTicket('ticket-2')
      useSelectionStore.getState().clearSelection()
      expect(useSelectionStore.getState().getSelectedIds()).toEqual([])
      expect(useSelectionStore.getState().lastSelectedId).toBeNull()
    })
  })

  describe('isSelected', () => {
    it('should return true for selected tickets', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(true)
    })

    it('should return false for unselected tickets', () => {
      expect(useSelectionStore.getState().isSelected('ticket-1')).toBe(false)
    })
  })

  describe('getSelectedIds', () => {
    it('should return array of selected IDs', () => {
      useSelectionStore.getState().selectTicket('ticket-1')
      useSelectionStore.getState().toggleTicket('ticket-2')
      const ids = useSelectionStore.getState().getSelectedIds()
      expect(ids).toContain('ticket-1')
      expect(ids).toContain('ticket-2')
      expect(ids).toHaveLength(2)
    })
  })
})
