/**
 * Fuzz tests for settings store invariants.
 * Tests that settings operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/stores/settings-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useSettingsStore.setState({
    openSinglePastedTicket: true,
    ticketDateMaxYearMode: 'default',
    ticketDateMaxYear: new Date().getFullYear() + 5,
    autoSaveOnDrawerClose: false,
  })
}

beforeEach(() => {
  resetStore()
})

describe('Settings Store Fuzz Tests', () => {
  describe('setOpenSinglePastedTicket', () => {
    it('should set openSinglePastedTicket to provided value', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setOpenSinglePastedTicket(value)

          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setOpenSinglePastedTicket(value)
          useSettingsStore.getState().setOpenSinglePastedTicket(value)

          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other settings', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          const initialMaxYearMode = useSettingsStore.getState().ticketDateMaxYearMode
          const initialMaxYear = useSettingsStore.getState().ticketDateMaxYear
          const initialAutoSave = useSettingsStore.getState().autoSaveOnDrawerClose

          useSettingsStore.getState().setOpenSinglePastedTicket(value)

          expect(useSettingsStore.getState().ticketDateMaxYearMode).toBe(initialMaxYearMode)
          expect(useSettingsStore.getState().ticketDateMaxYear).toBe(initialMaxYear)
          expect(useSettingsStore.getState().autoSaveOnDrawerClose).toBe(initialAutoSave)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setTicketDateMaxYearMode', () => {
    it('should set ticketDateMaxYearMode to provided value', () => {
      fc.assert(
        fc.property(fc.constantFrom('default', 'custom'), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYearMode(value)

          expect(useSettingsStore.getState().ticketDateMaxYearMode).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.constantFrom('default', 'custom'), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYearMode(value)
          useSettingsStore.getState().setTicketDateMaxYearMode(value)

          expect(useSettingsStore.getState().ticketDateMaxYearMode).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other settings', () => {
      fc.assert(
        fc.property(fc.constantFrom('default', 'custom'), (value) => {
          resetStore()
          const initialOpenSingle = useSettingsStore.getState().openSinglePastedTicket
          const initialMaxYear = useSettingsStore.getState().ticketDateMaxYear
          const initialAutoSave = useSettingsStore.getState().autoSaveOnDrawerClose

          useSettingsStore.getState().setTicketDateMaxYearMode(value)

          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(initialOpenSingle)
          expect(useSettingsStore.getState().ticketDateMaxYear).toBe(initialMaxYear)
          expect(useSettingsStore.getState().autoSaveOnDrawerClose).toBe(initialAutoSave)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setTicketDateMaxYear', () => {
    it('should set ticketDateMaxYear to provided value', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2000, max: 3000 }), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYear(value)

          expect(useSettingsStore.getState().ticketDateMaxYear).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2000, max: 3000 }), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYear(value)
          useSettingsStore.getState().setTicketDateMaxYear(value)

          expect(useSettingsStore.getState().ticketDateMaxYear).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other settings', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2000, max: 3000 }), (value) => {
          resetStore()
          const initialOpenSingle = useSettingsStore.getState().openSinglePastedTicket
          const initialMaxYearMode = useSettingsStore.getState().ticketDateMaxYearMode
          const initialAutoSave = useSettingsStore.getState().autoSaveOnDrawerClose

          useSettingsStore.getState().setTicketDateMaxYear(value)

          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(initialOpenSingle)
          expect(useSettingsStore.getState().ticketDateMaxYearMode).toBe(initialMaxYearMode)
          expect(useSettingsStore.getState().autoSaveOnDrawerClose).toBe(initialAutoSave)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setAutoSaveOnDrawerClose', () => {
    it('should set autoSaveOnDrawerClose to provided value', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setAutoSaveOnDrawerClose(value)

          expect(useSettingsStore.getState().autoSaveOnDrawerClose).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setAutoSaveOnDrawerClose(value)
          useSettingsStore.getState().setAutoSaveOnDrawerClose(value)

          expect(useSettingsStore.getState().autoSaveOnDrawerClose).toBe(value)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other settings', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          const initialOpenSingle = useSettingsStore.getState().openSinglePastedTicket
          const initialMaxYearMode = useSettingsStore.getState().ticketDateMaxYearMode
          const initialMaxYear = useSettingsStore.getState().ticketDateMaxYear

          useSettingsStore.getState().setAutoSaveOnDrawerClose(value)

          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(initialOpenSingle)
          expect(useSettingsStore.getState().ticketDateMaxYearMode).toBe(initialMaxYearMode)
          expect(useSettingsStore.getState().ticketDateMaxYear).toBe(initialMaxYear)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('combined settings changes', () => {
    it('should handle multiple setting changes independently', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.constantFrom('default', 'custom'),
          fc.integer({ min: 2000, max: 3000 }),
          fc.boolean(),
          (openSingle, maxYearMode, maxYear, autoSave) => {
            resetStore()

            useSettingsStore.getState().setOpenSinglePastedTicket(openSingle)
            useSettingsStore.getState().setTicketDateMaxYearMode(maxYearMode)
            useSettingsStore.getState().setTicketDateMaxYear(maxYear)
            useSettingsStore.getState().setAutoSaveOnDrawerClose(autoSave)

            const state = useSettingsStore.getState()
            expect(state.openSinglePastedTicket).toBe(openSingle)
            expect(state.ticketDateMaxYearMode).toBe(maxYearMode)
            expect(state.ticketDateMaxYear).toBe(maxYear)
            expect(state.autoSaveOnDrawerClose).toBe(autoSave)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle rapid setting changes', () => {
      fc.assert(
        fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (values) => {
          resetStore()

          for (const value of values) {
            useSettingsStore.getState().setOpenSinglePastedTicket(value)
          }

          const lastValue = values[values.length - 1]
          expect(useSettingsStore.getState().openSinglePastedTicket).toBe(lastValue)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('state consistency', () => {
    it('should maintain boolean type for openSinglePastedTicket', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setOpenSinglePastedTicket(value)

          expect(typeof useSettingsStore.getState().openSinglePastedTicket).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should maintain boolean type for autoSaveOnDrawerClose', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          resetStore()
          useSettingsStore.getState().setAutoSaveOnDrawerClose(value)

          expect(typeof useSettingsStore.getState().autoSaveOnDrawerClose).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should maintain valid ticketDateMaxYearMode values', () => {
      fc.assert(
        fc.property(fc.constantFrom('default', 'custom'), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYearMode(value)

          const result = useSettingsStore.getState().ticketDateMaxYearMode
          expect(['default', 'custom']).toContain(result)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should maintain number type for ticketDateMaxYear', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2000, max: 3000 }), (value) => {
          resetStore()
          useSettingsStore.getState().setTicketDateMaxYear(value)

          expect(typeof useSettingsStore.getState().ticketDateMaxYear).toBe('number')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
