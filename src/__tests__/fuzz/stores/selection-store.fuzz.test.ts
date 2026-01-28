/**
 * Fuzz tests for selection store invariants.
 * Tests that selection operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSelectionStore } from '@/stores/selection-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state - call at start of each property
function resetStore() {
  useSelectionStore.setState({
    selectedTicketIds: new Set(),
    lastSelectedId: null,
    ticketOrigins: new Map(),
    copiedTicketIds: [],
  })
}

// Unique ticket IDs (no duplicates)
const uniqueTicketIds = fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 20 })

// Reset store before each test suite
beforeEach(() => {
  resetStore()
})

describe('Selection Store Fuzz Tests', () => {
  describe('selectTicket', () => {
    it('should result in exactly 1 selected ticket', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(ticketId)

          const selected = store.getSelectedIds()
          expect(selected.length).toBe(1)
          expect(selected[0]).toBe(ticketId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should replace previous selection', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (firstId, secondId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(firstId)
          store.selectTicket(secondId)

          const selected = store.getSelectedIds()
          expect(selected.length).toBe(1)
          expect(selected[0]).toBe(secondId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should update lastSelectedId', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(ticketId)

          expect(useSelectionStore.getState().lastSelectedId).toBe(ticketId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should clear ticket origins', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (originTicketId, selectTicketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          // Set an origin
          store.setTicketOrigin(originTicketId, { columnId: 'col-1', position: 0 })
          expect(store.getTicketOrigin(originTicketId)).toBeDefined()

          // Select a ticket (should clear origins)
          store.selectTicket(selectTicketId)

          expect(useSelectionStore.getState().ticketOrigins.size).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('toggleTicket', () => {
    it('should flip selection state', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          const initiallySelected = store.isSelected(ticketId)
          store.toggleTicket(ticketId)
          const afterToggle = useSelectionStore.getState().isSelected(ticketId)

          expect(afterToggle).toBe(!initiallySelected)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent with two toggles', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          const initial = store.isSelected(ticketId)
          store.toggleTicket(ticketId)
          useSelectionStore.getState().toggleTicket(ticketId)
          const afterTwoToggles = useSelectionStore.getState().isSelected(ticketId)

          expect(afterTwoToggles).toBe(initial)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve other selections when adding', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (firstId, secondId) => {
          fc.pre(firstId !== secondId)
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(firstId)
          useSelectionStore.getState().toggleTicket(secondId)

          const selected = useSelectionStore.getState().getSelectedIds()

          expect(selected).toContain(firstId)
          expect(selected).toContain(secondId)
          expect(selected.length).toBe(2)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('selectRange', () => {
    it('should cover continuous range between anchor and target', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 5, maxLength: 20 }),
          fc.nat(),
          fc.nat(),
          (allIds, startIdx, endIdx) => {
            resetStore()
            // Ensure indices are valid
            const start = startIdx % allIds.length
            const end = endIdx % allIds.length

            const store = useSelectionStore.getState()

            // Select first ticket to set anchor
            store.selectTicket(allIds[start])

            // Select range to target
            useSelectionStore.getState().selectRange(allIds[end], allIds)

            const selected = new Set(useSelectionStore.getState().getSelectedIds())

            // All tickets in range should be selected
            const rangeStart = Math.min(start, end)
            const rangeEnd = Math.max(start, end)

            for (let i = rangeStart; i <= rangeEnd; i++) {
              expect(selected.has(allIds[i])).toBe(true)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle single ticket when no previous selection', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.nat(),
          (allIds, idx) => {
            resetStore()
            const targetIdx = idx % allIds.length
            const store = useSelectionStore.getState()

            // No previous selection
            store.selectRange(allIds[targetIdx], allIds)

            const selected = useSelectionStore.getState().getSelectedIds()
            expect(selected.length).toBe(1)
            expect(selected[0]).toBe(allIds[targetIdx])
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should merge with existing selection', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 5, maxLength: 20 }),
          fc.nat(),
          fc.nat(),
          fc.uuid(),
          (allIds, startIdx, endIdx, extraId) => {
            resetStore()
            // Skip if extraId is in allIds (would complicate the test logic)
            fc.pre(!allIds.includes(extraId))

            const start = startIdx % allIds.length
            const end = endIdx % allIds.length

            const store = useSelectionStore.getState()

            // Set anchor first using selectTicket
            store.selectTicket(allIds[start])

            // Add an extra ticket outside the range using addToSelection
            // (don't use toggle as it changes lastSelectedId)
            useSelectionStore.getState().addToSelection([extraId])

            // Now do range selection - should merge with existing selection
            useSelectionStore.getState().selectRange(allIds[end], allIds)

            const selected = new Set(useSelectionStore.getState().getSelectedIds())

            // Extra ticket should still be selected (selectRange merges, doesn't replace)
            expect(selected.has(extraId)).toBe(true)

            // Range should also be selected
            const rangeStart = Math.min(start, end)
            const rangeEnd = Math.max(start, end)
            for (let i = rangeStart; i <= rangeEnd; i++) {
              expect(selected.has(allIds[i])).toBe(true)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('copySelected and getCopiedIds', () => {
    it('should copy selected tickets to clipboard', () => {
      fc.assert(
        fc.property(uniqueTicketIds, (ids) => {
          resetStore()
          const store = useSelectionStore.getState()

          // Select some tickets
          for (const id of ids) {
            store.toggleTicket(id)
          }

          // Copy
          useSelectionStore.getState().copySelected()

          const copied = useSelectionStore.getState().getCopiedIds()

          // Should contain all selected
          const selectedSet = new Set(ids)
          for (const copiedId of copied) {
            expect(selectedSet.has(copiedId)).toBe(true)
          }
          expect(copied.length).toBe(selectedSet.size)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve clipboard after selection changes', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (id1, id2) => {
          fc.pre(id1 !== id2)
          resetStore()
          const store = useSelectionStore.getState()

          // Select and copy
          store.selectTicket(id1)
          useSelectionStore.getState().copySelected()

          // Change selection
          useSelectionStore.getState().selectTicket(id2)

          // Clipboard should still have original
          const copied = useSelectionStore.getState().getCopiedIds()
          expect(copied).toContain(id1)
          expect(copied).not.toContain(id2)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clearSelection', () => {
    it('should empty all selections', () => {
      fc.assert(
        fc.property(uniqueTicketIds, (ids) => {
          resetStore()
          const store = useSelectionStore.getState()

          // Select some tickets
          for (const id of ids) {
            store.toggleTicket(id)
          }

          useSelectionStore.getState().clearSelection()

          const selected = useSelectionStore.getState().getSelectedIds()
          expect(selected.length).toBe(0)
          expect(useSelectionStore.getState().lastSelectedId).toBeNull()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should clear ticket origins', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.setTicketOrigin(ticketId, { columnId: 'col-1', position: 0 })
          useSelectionStore.getState().clearSelection()

          expect(useSelectionStore.getState().ticketOrigins.size).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect clipboard', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(ticketId)
          useSelectionStore.getState().copySelected()
          useSelectionStore.getState().clearSelection()

          const copied = useSelectionStore.getState().getCopiedIds()
          expect(copied).toContain(ticketId)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clearClipboard', () => {
    it('should empty clipboard', () => {
      fc.assert(
        fc.property(uniqueTicketIds, (ids) => {
          resetStore()
          const store = useSelectionStore.getState()

          // Select and copy
          for (const id of ids) {
            store.toggleTicket(id)
          }
          useSelectionStore.getState().copySelected()

          useSelectionStore.getState().clearClipboard()

          const copied = useSelectionStore.getState().getCopiedIds()
          expect(copied.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect selection', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()

          store.selectTicket(ticketId)
          useSelectionStore.getState().copySelected()
          useSelectionStore.getState().clearClipboard()

          const selected = useSelectionStore.getState().getSelectedIds()
          expect(selected).toContain(ticketId)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('isSelected', () => {
    it('should correctly report selection state', () => {
      fc.assert(
        fc.property(uniqueTicketIds, fc.uuid(), (ids, queryId) => {
          resetStore()
          const store = useSelectionStore.getState()

          for (const id of ids) {
            store.toggleTicket(id)
          }

          const isSelected = useSelectionStore.getState().isSelected(queryId)
          const shouldBeSelected = ids.includes(queryId)

          expect(isSelected).toBe(shouldBeSelected)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('addToSelection', () => {
    it('should add all tickets to selection', () => {
      fc.assert(
        fc.property(uniqueTicketIds, uniqueTicketIds, (initial, toAdd) => {
          resetStore()
          const store = useSelectionStore.getState()

          // Initial selection
          for (const id of initial) {
            store.toggleTicket(id)
          }

          useSelectionStore.getState().addToSelection(toAdd)

          const selected = new Set(useSelectionStore.getState().getSelectedIds())

          // All added tickets should be selected
          for (const id of toAdd) {
            expect(selected.has(id)).toBe(true)
          }

          // Original selections should still be there
          for (const id of initial) {
            expect(selected.has(id)).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('ticketOrigins', () => {
    it('should set and get origins correctly', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), fc.nat({ max: 100 }), (ticketId, columnId, position) => {
          resetStore()
          const store = useSelectionStore.getState()
          const origin = { columnId, position }

          store.setTicketOrigin(ticketId, origin)

          const retrieved = useSelectionStore.getState().getTicketOrigin(ticketId)
          expect(retrieved).toEqual(origin)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined for unknown ticket', () => {
      fc.assert(
        fc.property(fc.uuid(), (ticketId) => {
          resetStore()
          const store = useSelectionStore.getState()
          const origin = store.getTicketOrigin(ticketId)

          expect(origin).toBeUndefined()
        }),
        FUZZ_CONFIG.quick,
      )
    })
  })
})
