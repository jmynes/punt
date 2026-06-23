import { beforeEach, describe, expect, it } from 'vitest'
import { useSprintStore } from '../sprint-store'

describe('Sprint Store', () => {
  beforeEach(() => {
    useSprintStore.setState({
      dismissedPrompts: {},
      sprintSorts: {},
      planningViewOpen: false,
    })
  })

  describe('dismissed completion prompts', () => {
    it('shouldShowPrompt is true for a sprint that was never dismissed', () => {
      expect(useSprintStore.getState().shouldShowPrompt('s1')).toBe(true)
    })

    it('still shows the prompt after dismissing with "later" (remind-me-later semantics)', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'later')
      // "later" records the dismissal but keeps the prompt eligible to reappear
      expect(useSprintStore.getState().shouldShowPrompt('s1')).toBe(true)
      expect(useSprintStore.getState().dismissedPrompts.s1.action).toBe('later')
    })

    it('suppresses the prompt after dismissing with "extend"', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'extend')
      expect(useSprintStore.getState().shouldShowPrompt('s1')).toBe(false)
    })

    it('records a dismissedAt timestamp', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'later')
      expect(typeof useSprintStore.getState().dismissedPrompts.s1.dismissedAt).toBe('number')
    })

    it('tracks dismissals per sprint independently', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'extend')
      expect(useSprintStore.getState().shouldShowPrompt('s1')).toBe(false)
      expect(useSprintStore.getState().shouldShowPrompt('s2')).toBe(true)
    })

    it('clears a single dismissed prompt, re-enabling its prompt', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'extend')
      useSprintStore.getState().dismissSprintPrompt('s2', 'extend')
      useSprintStore.getState().clearDismissedPrompt('s1')
      expect(useSprintStore.getState().shouldShowPrompt('s1')).toBe(true)
      expect(useSprintStore.getState().shouldShowPrompt('s2')).toBe(false)
    })

    it('clears all dismissed prompts', () => {
      useSprintStore.getState().dismissSprintPrompt('s1', 'later')
      useSprintStore.getState().dismissSprintPrompt('s2', 'extend')
      useSprintStore.getState().clearAllDismissedPrompts()
      expect(useSprintStore.getState().dismissedPrompts).toEqual({})
    })
  })

  describe('per-section sort configuration', () => {
    it('returns null for an unset section', () => {
      expect(useSprintStore.getState().getSprintSort('backlog')).toBeNull()
    })

    it('sets and retrieves a section sort', () => {
      const sort = { field: 'priority', direction: 'desc' as const }
      useSprintStore.getState().setSprintSort('s1', sort)
      expect(useSprintStore.getState().getSprintSort('s1')).toEqual(sort)
    })

    it('keeps section sorts independent', () => {
      useSprintStore
        .getState()
        .setSprintSort('s1', { field: 'priority', direction: 'asc' as const })
      expect(useSprintStore.getState().getSprintSort('s2')).toBeNull()
    })

    it('allows resetting a section sort to null', () => {
      useSprintStore
        .getState()
        .setSprintSort('s1', { field: 'priority', direction: 'asc' as const })
      useSprintStore.getState().setSprintSort('s1', null)
      expect(useSprintStore.getState().getSprintSort('s1')).toBeNull()
    })

    it('clears all section sorts', () => {
      useSprintStore
        .getState()
        .setSprintSort('s1', { field: 'priority', direction: 'asc' as const })
      useSprintStore.getState().setSprintSort('s2', { field: 'type', direction: 'desc' as const })
      useSprintStore.getState().clearAllSprintSorts()
      expect(useSprintStore.getState().sprintSorts).toEqual({})
    })
  })

  describe('planning view', () => {
    it('toggles the planning view open state', () => {
      expect(useSprintStore.getState().planningViewOpen).toBe(false)
      useSprintStore.getState().setPlanningViewOpen(true)
      expect(useSprintStore.getState().planningViewOpen).toBe(true)
      useSprintStore.getState().setPlanningViewOpen(false)
      expect(useSprintStore.getState().planningViewOpen).toBe(false)
    })
  })
})
