/**
 * Fuzz tests for sprint store invariants.
 * Tests that sprint prompt dismissal tracking works correctly.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSprintStore } from '@/stores/sprint-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useSprintStore.setState({
    dismissedPrompts: {},
    planningViewOpen: false,
    _hasHydrated: true,
  })
}

// Dismiss action generator
const dismissAction = fc.constantFrom<'later' | 'extend'>('later', 'extend')

beforeEach(() => {
  resetStore()
})

describe('Sprint Store Fuzz Tests', () => {
  describe('dismissSprintPrompt', () => {
    it('should store dismissal for sprint', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, (sprintId, action) => {
          resetStore()
          const beforeTime = Date.now()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action)

          const state = useSprintStore.getState()
          const dismissed = state.dismissedPrompts[sprintId]

          expect(dismissed).toBeDefined()
          expect(dismissed.action).toBe(action)
          expect(dismissed.dismissedAt).toBeGreaterThanOrEqual(beforeTime)
          expect(dismissed.dismissedAt).toBeLessThanOrEqual(Date.now())
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should update on subsequent dismissals', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, dismissAction, (sprintId, action1, action2) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action1)
          const first = useSprintStore.getState().dismissedPrompts[sprintId]

          useSprintStore.getState().dismissSprintPrompt(sprintId, action2)
          const second = useSprintStore.getState().dismissedPrompts[sprintId]

          expect(second.action).toBe(action2)
          expect(second.dismissedAt).toBeGreaterThanOrEqual(first.dismissedAt)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other sprints', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), dismissAction, (sprintId1, sprintId2, action) => {
          fc.pre(sprintId1 !== sprintId2)
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId1, action)
          const timestamp1 = useSprintStore.getState().dismissedPrompts[sprintId1].dismissedAt

          useSprintStore.getState().dismissSprintPrompt(sprintId2, action)

          // First sprint's data should be unchanged
          expect(useSprintStore.getState().dismissedPrompts[sprintId1].dismissedAt).toBe(timestamp1)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('shouldShowPrompt', () => {
    it('should return true for never-dismissed sprint', () => {
      fc.assert(
        fc.property(fc.uuid(), (sprintId) => {
          resetStore()

          const shouldShow = useSprintStore.getState().shouldShowPrompt(sprintId)

          expect(shouldShow).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return false for sprint dismissed with extend', () => {
      fc.assert(
        fc.property(fc.uuid(), (sprintId) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, 'extend')
          const shouldShow = useSprintStore.getState().shouldShowPrompt(sprintId)

          expect(shouldShow).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return true for sprint dismissed with later (no cooldown)', () => {
      fc.assert(
        fc.property(fc.uuid(), (sprintId) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, 'later')
          const shouldShow = useSprintStore.getState().shouldShowPrompt(sprintId)

          // 'later' does not suppress the prompt — only 'extend' does
          expect(shouldShow).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never return true for extend regardless of time', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.nat({ max: 365 * 24 * 60 * 60 * 1000 }), // Up to a year
          (sprintId, timeAgoMs) => {
            resetStore()

            const oldTimestamp = Date.now() - timeAgoMs
            useSprintStore.setState({
              dismissedPrompts: {
                [sprintId]: { dismissedAt: oldTimestamp, action: 'extend' },
              },
            })

            const shouldShow = useSprintStore.getState().shouldShowPrompt(sprintId)

            expect(shouldShow).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clearDismissedPrompt', () => {
    it('should remove dismissal for sprint', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, (sprintId, action) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action)
          expect(useSprintStore.getState().dismissedPrompts[sprintId]).toBeDefined()

          useSprintStore.getState().clearDismissedPrompt(sprintId)

          expect(useSprintStore.getState().dismissedPrompts[sprintId]).toBeUndefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should allow prompt to show again after clearing', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, (sprintId, action) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action)
          useSprintStore.getState().clearDismissedPrompt(sprintId)

          expect(useSprintStore.getState().shouldShowPrompt(sprintId)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other sprints', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), dismissAction, (sprintId1, sprintId2, action) => {
          fc.pre(sprintId1 !== sprintId2)
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId1, action)
          useSprintStore.getState().dismissSprintPrompt(sprintId2, action)

          useSprintStore.getState().clearDismissedPrompt(sprintId1)

          expect(useSprintStore.getState().dismissedPrompts[sprintId1]).toBeUndefined()
          expect(useSprintStore.getState().dismissedPrompts[sprintId2]).toBeDefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle non-existent sprint gracefully', () => {
      fc.assert(
        fc.property(fc.uuid(), (sprintId) => {
          resetStore()

          // Should not throw
          useSprintStore.getState().clearDismissedPrompt(sprintId)

          expect(useSprintStore.getState().dismissedPrompts[sprintId]).toBeUndefined()
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clearAllDismissedPrompts', () => {
    it('should clear all dismissed prompts', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
          dismissAction,
          (sprintIds, action) => {
            resetStore()

            // Dismiss all
            for (const id of sprintIds) {
              useSprintStore.getState().dismissSprintPrompt(id, action)
            }

            useSprintStore.getState().clearAllDismissedPrompts()

            expect(Object.keys(useSprintStore.getState().dismissedPrompts).length).toBe(0)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('planningViewOpen', () => {
    it('should set planning view state', () => {
      fc.assert(
        fc.property(fc.boolean(), (open) => {
          resetStore()

          useSprintStore.getState().setPlanningViewOpen(open)

          expect(useSprintStore.getState().planningViewOpen).toBe(open)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect dismissed prompts', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, fc.boolean(), (sprintId, action, open) => {
          resetStore()
          useSprintStore.getState().dismissSprintPrompt(sprintId, action)
          const dismissed = useSprintStore.getState().dismissedPrompts[sprintId]

          useSprintStore.getState().setPlanningViewOpen(open)

          expect(useSprintStore.getState().dismissedPrompts[sprintId]).toEqual(dismissed)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('multiple sprints', () => {
    it('should track dismissals independently for each sprint', () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 10 }), (sprintIds) => {
          resetStore()

          // Dismiss all with 'extend'
          for (const id of sprintIds) {
            useSprintStore.getState().dismissSprintPrompt(id, 'extend')
          }

          // All should not show
          for (const id of sprintIds) {
            expect(useSprintStore.getState().shouldShowPrompt(id)).toBe(false)
          }

          // Clear first sprint
          useSprintStore.getState().clearDismissedPrompt(sprintIds[0])

          // First should show, others should not
          expect(useSprintStore.getState().shouldShowPrompt(sprintIds[0])).toBe(true)
          for (const id of sprintIds.slice(1)) {
            expect(useSprintStore.getState().shouldShowPrompt(id)).toBe(false)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('state consistency', () => {
    it('should maintain valid timestamp values', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, (sprintId, action) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action)

          const dismissed = useSprintStore.getState().dismissedPrompts[sprintId]
          expect(typeof dismissed.dismissedAt).toBe('number')
          expect(Number.isFinite(dismissed.dismissedAt)).toBe(true)
          expect(dismissed.dismissedAt).toBeGreaterThan(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should maintain valid action values', () => {
      fc.assert(
        fc.property(fc.uuid(), dismissAction, (sprintId, action) => {
          resetStore()

          useSprintStore.getState().dismissSprintPrompt(sprintId, action)

          const dismissed = useSprintStore.getState().dismissedPrompts[sprintId]
          expect(['later', 'extend']).toContain(dismissed.action)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
