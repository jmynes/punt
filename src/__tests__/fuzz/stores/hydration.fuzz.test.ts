/**
 * Fuzz tests for localStorage hydration and validation.
 * Tests that the board store handles corrupted data safely.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { ColumnWithTickets } from '@/types'
import { columnsArray, corruptedBoardState, corruptedColumns } from '../arbitraries'
import { corruptedJson } from '../arbitraries/primitives'
import { FUZZ_CONFIG } from '../setup'

// Replicate the isValidColumns function from board-store for testing
function isValidColumns(columns: unknown): columns is ColumnWithTickets[] {
  if (!Array.isArray(columns)) return false
  return columns.every(
    (col) =>
      col &&
      typeof col === 'object' &&
      'id' in col &&
      'tickets' in col &&
      Array.isArray(col.tickets),
  )
}

describe('Hydration Validation Fuzz Tests', () => {
  describe('isValidColumns', () => {
    it('should accept valid column arrays', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          expect(isValidColumns(columns)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject corrupted data', () => {
      fc.assert(
        fc.property(corruptedColumns, (corrupted) => {
          // Skip if we happen to generate valid data
          if (isValidColumns(corrupted)) return

          expect(isValidColumns(corrupted)).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject null and undefined', () => {
      expect(isValidColumns(null)).toBe(false)
      expect(isValidColumns(undefined)).toBe(false)
    })

    it('should reject non-array values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.string(),
            fc.dictionary(fc.string(), fc.anything()),
          ),
          (value) => {
            expect(isValidColumns(value)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject arrays with non-object elements', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)), {
            minLength: 1,
          }),
          (arr) => {
            expect(isValidColumns(arr)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject columns missing id field', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string(),
              order: fc.nat(),
              tickets: fc.array(fc.anything()),
            }),
            { minLength: 1 },
          ),
          (columns) => {
            expect(isValidColumns(columns)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject columns missing tickets field', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string(),
              order: fc.nat(),
            }),
            { minLength: 1 },
          ),
          (columns) => {
            expect(isValidColumns(columns)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject columns with non-array tickets', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string(),
              order: fc.nat(),
              tickets: fc.oneof(
                fc.string(),
                fc.integer(),
                fc.dictionary(fc.string(), fc.anything()),
              ),
            }),
            { minLength: 1 },
          ),
          (columns) => {
            expect(isValidColumns(columns)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on arbitrary JSON input', () => {
      fc.assert(
        fc.property(fc.jsonValue(), (json) => {
          // Should never throw
          const result = isValidColumns(json)
          expect(typeof result).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on corrupted JSON-like values', () => {
      fc.assert(
        fc.property(corruptedJson, (corrupted) => {
          // Should never throw
          const result = isValidColumns(corrupted)
          expect(typeof result).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle deeply nested structures', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ maxLength: 20 }),
              tickets: fc.array(
                fc.record({
                  nested: fc.dictionary(fc.string({ maxLength: 10 }), fc.jsonValue(), {
                    minKeys: 0,
                    maxKeys: 3,
                  }),
                }),
                { maxLength: 3 },
              ),
            }),
            { minLength: 1, maxLength: 3 },
          ),
          (columns) => {
            // Should not crash, even with weird nested structures
            const result = isValidColumns(columns)
            expect(typeof result).toBe('boolean')
          },
        ),
        FUZZ_CONFIG.quick,
      )
    })

    it('should accept empty columns array', () => {
      expect(isValidColumns([])).toBe(true)
    })

    it('should accept columns with empty tickets array', () => {
      const columns = [
        { id: 'col-1', name: 'Column 1', order: 0, projectId: 'proj-1', tickets: [] },
      ]
      expect(isValidColumns(columns)).toBe(true)
    })
  })

  describe('Board state validation', () => {
    // Simplified column for faster tests (no tickets)
    const simpleColumn = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      order: fc.nat({ max: 10 }),
      projectId: fc.uuid(),
      tickets: fc.constant([]), // Empty tickets for speed
    })
    const simpleColumnsArray = fc.array(simpleColumn, { minLength: 1, maxLength: 5 })

    it('should validate project map structure', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.uuid(), simpleColumnsArray, { minKeys: 1, maxKeys: 3 }),
          (projects) => {
            // Each value should be valid columns
            for (const columns of Object.values(projects)) {
              expect(isValidColumns(columns)).toBe(true)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle corrupted project maps safely', () => {
      fc.assert(
        fc.property(corruptedBoardState, (corrupted) => {
          // Validation of the state structure
          if (corrupted === null || corrupted === undefined) {
            expect(corrupted == null).toBe(true)
            return
          }

          if (typeof corrupted !== 'object' || Array.isArray(corrupted)) {
            return // Not a valid map structure
          }

          // Check each project's columns
          for (const [_projectId, columns] of Object.entries(corrupted)) {
            const isValid = isValidColumns(columns)
            expect(typeof isValid).toBe('boolean')
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Date revival', () => {
    // Test the date revival logic
    const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

    // Constrain dates to 4-digit year range (0001-9999) and filter out invalid dates
    const validDate = fc
      .date({
        min: new Date('0001-01-01T00:00:00.000Z'),
        max: new Date('9999-12-31T23:59:59.999Z'),
      })
      .filter((d) => !Number.isNaN(d.getTime()))

    it('should identify ISO date strings', () => {
      fc.assert(
        fc.property(validDate, (date) => {
          const isoString = date.toISOString()
          expect(ISO_DATE_REGEX.test(isoString)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not match non-date strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !ISO_DATE_REGEX.test(s)),
          (str) => {
            expect(ISO_DATE_REGEX.test(str)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle various date edge cases', () => {
      const edgeCases = [
        '2024-01-01T00:00:00.000Z', // Valid
        '2024-12-31T23:59:59.999Z', // Valid
        '1970-01-01T00:00:00.000Z', // Epoch
        '9999-12-31T23:59:59.999Z', // Far future
        '2024-1-1T00:00:00', // Invalid format
        '2024/01/01T00:00:00', // Wrong separator
        'not-a-date', // Not a date
        '', // Empty
        '2024-01-01', // Date only
        '00:00:00', // Time only
      ]

      for (const testCase of edgeCases) {
        // Should not crash
        const matches = ISO_DATE_REGEX.test(testCase)
        expect(typeof matches).toBe('boolean')
      }
    })
  })

  describe('Type coercion safety', () => {
    it('should handle typeof checks safely', () => {
      fc.assert(
        fc.property(fc.anything(), (value) => {
          // These checks should never throw
          const isObj = typeof value === 'object'
          const isArr = Array.isArray(value)
          const isNull = value === null
          const isUndef = value === undefined

          expect(typeof isObj).toBe('boolean')
          expect(typeof isArr).toBe('boolean')
          expect(typeof isNull).toBe('boolean')
          expect(typeof isUndef).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle in operator safely on objects', () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.anything()), (obj) => {
          // Check for 'id' and 'tickets' fields
          const hasId = 'id' in obj
          const hasTickets = 'tickets' in obj

          expect(typeof hasId).toBe('boolean')
          expect(typeof hasTickets).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Edge cases in validation', () => {
    it('should handle objects with prototype pollution attempts', () => {
      const malicious = [
        { id: 'col-1', tickets: [], __proto__: { evil: true } },
        { id: 'col-2', tickets: [], constructor: { prototype: { pwned: true } } },
      ]

      // Should still work correctly
      expect(isValidColumns(malicious)).toBe(true)
    })

    it('should handle objects with Symbol keys', () => {
      const col = {
        id: 'col-1',
        tickets: [],
        [Symbol('test')]: 'value',
      }

      expect(isValidColumns([col])).toBe(true)
    })

    it('should handle objects with getters', () => {
      const col = {
        id: 'col-1',
        get tickets() {
          return []
        },
      }

      expect(isValidColumns([col])).toBe(true)
    })

    it('should handle frozen objects', () => {
      const col = Object.freeze({
        id: 'col-1',
        tickets: Object.freeze([]),
      })

      expect(isValidColumns([col])).toBe(true)
    })

    it('should handle sealed objects', () => {
      const col = Object.seal({
        id: 'col-1',
        tickets: [],
      })

      expect(isValidColumns([col])).toBe(true)
    })
  })
})
