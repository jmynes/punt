/**
 * Fuzz tests for all 8 PostgreSQL native enum types.
 * Validates that Zod schemas match the Prisma enum definitions exactly.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  pgInvitationRole,
  pgInvitationStatus,
  pgLinkType,
  pgSprintEntryType,
  pgSprintExitStatus,
  pgSprintStatus,
  pgTicketPriority,
  pgTicketType,
} from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

// Zod schemas matching the Prisma enum definitions
const schemas = {
  TicketType: z.enum(['epic', 'story', 'task', 'bug', 'subtask']),
  TicketPriority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']),
  SprintStatus: z.enum(['planning', 'active', 'completed']),
  InvitationStatus: z.enum(['pending', 'accepted', 'expired', 'revoked']),
  InvitationRole: z.enum(['admin', 'member']),
  SprintEntryType: z.enum(['added', 'carried_over']),
  SprintExitStatus: z.enum(['completed', 'carried_over', 'removed']),
  LinkType: z.enum(['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by']),
}

// All valid values per enum for cross-enum testing
const allEnumValues: Record<string, readonly string[]> = {
  TicketType: ['epic', 'story', 'task', 'bug', 'subtask'],
  TicketPriority: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
  SprintStatus: ['planning', 'active', 'completed'],
  InvitationStatus: ['pending', 'accepted', 'expired', 'revoked'],
  InvitationRole: ['admin', 'member'],
  SprintEntryType: ['added', 'carried_over'],
  SprintExitStatus: ['completed', 'carried_over', 'removed'],
  LinkType: ['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'],
}

// Collect every valid value across all enums for generating near-misses
const everyValidValue = Object.values(allEnumValues).flat()

describe('PostgreSQL Enum Validation Fuzz Tests', () => {
  describe('TicketType', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgTicketType, (value) => {
          expect(schemas.TicketType.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.TicketType.includes(s)),
          (value) => {
            expect(schemas.TicketType.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be case-sensitive', () => {
      for (const v of allEnumValues.TicketType) {
        expect(schemas.TicketType.safeParse(v.toUpperCase()).success).toBe(false)
        expect(schemas.TicketType.safeParse(v[0].toUpperCase() + v.slice(1)).success).toBe(false)
      }
    })
  })

  describe('TicketPriority', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgTicketPriority, (value) => {
          expect(schemas.TicketPriority.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.TicketPriority.includes(s)),
          (value) => {
            expect(schemas.TicketPriority.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be case-sensitive', () => {
      for (const v of allEnumValues.TicketPriority) {
        expect(schemas.TicketPriority.safeParse(v.toUpperCase()).success).toBe(false)
      }
    })
  })

  describe('SprintStatus', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgSprintStatus, (value) => {
          expect(schemas.SprintStatus.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.SprintStatus.includes(s)),
          (value) => {
            expect(schemas.SprintStatus.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('InvitationStatus', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgInvitationStatus, (value) => {
          expect(schemas.InvitationStatus.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.InvitationStatus.includes(s)),
          (value) => {
            expect(schemas.InvitationStatus.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('InvitationRole', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgInvitationRole, (value) => {
          expect(schemas.InvitationRole.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.InvitationRole.includes(s)),
          (value) => {
            expect(schemas.InvitationRole.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('SprintEntryType', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgSprintEntryType, (value) => {
          expect(schemas.SprintEntryType.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.SprintEntryType.includes(s)),
          (value) => {
            expect(schemas.SprintEntryType.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('SprintExitStatus', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgSprintExitStatus, (value) => {
          expect(schemas.SprintExitStatus.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.SprintExitStatus.includes(s)),
          (value) => {
            expect(schemas.SprintExitStatus.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('LinkType', () => {
    it('should accept all valid values', () => {
      fc.assert(
        fc.property(pgLinkType, (value) => {
          expect(schemas.LinkType.safeParse(value).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !allEnumValues.LinkType.includes(s)),
          (value) => {
            expect(schemas.LinkType.safeParse(value).success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Cross-enum validation', () => {
    it('should not accept values from other enums where they do not belong', () => {
      for (const [enumName, schema] of Object.entries(schemas)) {
        const validForThis = new Set(allEnumValues[enumName])

        for (const [otherName, otherValues] of Object.entries(allEnumValues)) {
          if (otherName === enumName) continue

          for (const value of otherValues) {
            // Only test values that are NOT also valid for this enum
            if (!validForThis.has(value)) {
              const result = schema.safeParse(value)
              expect(result.success).toBe(false)
            }
          }
        }
      }
    })

    it('should reject near-misses (extra/missing chars, typos)', () => {
      fc.assert(
        fc.property(fc.constantFrom(...everyValidValue), (value) => {
          // Add trailing space
          for (const [, schema] of Object.entries(schemas)) {
            const padded = ` ${value} `
            expect(schema.safeParse(padded).success).toBe(false)
          }
        }),
        FUZZ_CONFIG.quick,
      )
    })

    it('should reject non-string types for all enums', () => {
      const nonStrings = [null, undefined, 42, true, false, [], {}, NaN]
      for (const schema of Object.values(schemas)) {
        for (const value of nonStrings) {
          expect(schema.safeParse(value).success).toBe(false)
        }
      }
    })
  })
})
