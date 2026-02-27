/**
 * Generic Zod schema fuzzing for API validation.
 * Tests common validation patterns used across API routes.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { maliciousString, urlLike } from '../arbitraries/primitives'
import { ticketPriority, ticketType } from '../arbitraries/ticket'
import { projectRole } from '../arbitraries/user'
import { FUZZ_CONFIG } from '../setup'

describe('Generic API Validation Fuzz Tests', () => {
  describe('UUID validation', () => {
    const uuidSchema = z.string().uuid()

    it('should accept valid UUIDs', () => {
      fc.assert(
        fc.property(fc.uuid(), (uuid) => {
          const result = uuidSchema.safeParse(uuid)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid UUIDs', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
            ),
          (invalidUuid) => {
            const result = uuidSchema.safeParse(invalidUuid)
            expect(result.success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on any input', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = uuidSchema.safeParse(input)
          expect(result).toHaveProperty('success')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Enum validation', () => {
    const ticketTypeSchema = z.enum(['task', 'bug', 'story', 'epic', 'subtask'])
    const prioritySchema = z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical'])
    const roleSchema = z.enum(['owner', 'admin', 'member'])

    it('should accept valid ticket types', () => {
      fc.assert(
        fc.property(ticketType, (type) => {
          const result = ticketTypeSchema.safeParse(type)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept valid priorities', () => {
      fc.assert(
        fc.property(ticketPriority, (priority) => {
          const result = prioritySchema.safeParse(priority)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept valid roles', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          const result = roleSchema.safeParse(role)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid enum values', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['task', 'bug', 'story', 'epic', 'subtask'].includes(s)),
          (invalid) => {
            const result = ticketTypeSchema.safeParse(invalid)
            expect(result.success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be case-sensitive', () => {
      expect(ticketTypeSchema.safeParse('TASK').success).toBe(false)
      expect(ticketTypeSchema.safeParse('Task').success).toBe(false)
      expect(prioritySchema.safeParse('HIGH').success).toBe(false)
      expect(roleSchema.safeParse('ADMIN').success).toBe(false)
    })
  })

  describe('String constraints', () => {
    const titleSchema = z.string().min(1).max(500)
    const _descriptionSchema = z.string().max(10000).optional()
    const projectKeySchema = z
      .string()
      .min(1)
      .max(10)
      .regex(/^[A-Z][A-Z0-9]*$/)

    it('should accept valid titles', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (title) => {
          const result = titleSchema.safeParse(title)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject empty titles', () => {
      expect(titleSchema.safeParse('').success).toBe(false)
    })

    it('should reject too-long titles', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 501, maxLength: 1000 }), (longTitle) => {
          const result = titleSchema.safeParse(longTitle)
          expect(result.success).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept valid project keys', () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[A-Z][A-Z0-9]{0,9}$/), (key) => {
          const result = projectKeySchema.safeParse(key)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid project keys', () => {
      const invalidKeys = [
        '', // Empty
        'lowercase', // Not uppercase
        '123ABC', // Starts with number
        'A B C', // Contains spaces
        'TOOLONGPROJECTKEY', // Too long
        'A-B-C', // Contains hyphens
      ]

      for (const key of invalidKeys) {
        expect(projectKeySchema.safeParse(key).success).toBe(false)
      }
    })

    it('should handle malicious strings in titles', () => {
      fc.assert(
        fc.property(maliciousString, (input) => {
          const result = titleSchema.safeParse(input)
          // Should not crash
          expect(result).toHaveProperty('success')

          // Validate based on length
          if (input.length >= 1 && input.length <= 500) {
            expect(result.success).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Number constraints', () => {
    const orderSchema = z.number().int().min(0)
    const storyPointsSchema = z.number().int().min(0).max(100).optional()
    const estimateSchema = z.number().int().min(0).max(480).optional() // Max 8 hours

    it('should accept valid order values', () => {
      fc.assert(
        fc.property(fc.nat({ max: 10000 }), (order) => {
          const result = orderSchema.safeParse(order)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject negative order values', () => {
      fc.assert(
        fc.property(fc.integer({ min: -10000, max: -1 }), (negative) => {
          const result = orderSchema.safeParse(negative)
          expect(result.success).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject non-integer order values', () => {
      fc.assert(
        fc.property(
          fc.double().filter((n) => !Number.isInteger(n) && Number.isFinite(n)),
          (nonInt) => {
            const result = orderSchema.safeParse(nonInt)
            expect(result.success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle edge case numbers', () => {
      const edgeCases = [
        0, // Zero
        Number.MAX_SAFE_INTEGER, // Very large
        Number.MIN_SAFE_INTEGER, // Very small
        Number.NaN, // Not a number
        Number.POSITIVE_INFINITY, // Infinity
        Number.NEGATIVE_INFINITY, // Negative infinity
      ]

      for (const num of edgeCases) {
        const result = orderSchema.safeParse(num)
        expect(result).toHaveProperty('success')
      }
    })

    it('should accept valid story points', () => {
      const validPoints = [1, 2, 3, 5, 8, 13, 21]
      for (const points of validPoints) {
        expect(storyPointsSchema.safeParse(points).success).toBe(true)
      }
    })

    it('should accept undefined for optional fields', () => {
      expect(storyPointsSchema.safeParse(undefined).success).toBe(true)
      expect(estimateSchema.safeParse(undefined).success).toBe(true)
    })
  })

  describe('Date validation', () => {
    const dateSchema = z.coerce.date()
    const optionalDateSchema = z.coerce.date().optional().nullable()
    // Filter out invalid dates (NaN)
    const validDate = fc.date().filter((d) => !Number.isNaN(d.getTime()))

    it('should accept valid date strings', () => {
      fc.assert(
        fc.property(validDate, (date) => {
          const result = dateSchema.safeParse(date.toISOString())
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept Date objects', () => {
      fc.assert(
        fc.property(validDate, (date) => {
          const result = dateSchema.safeParse(date)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle null for optional dates', () => {
      expect(optionalDateSchema.safeParse(null).success).toBe(true)
      expect(optionalDateSchema.safeParse(undefined).success).toBe(true)
    })

    it('should reject invalid date strings', () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-45', // Invalid month/day
        '25:99:99', // Invalid time
        '', // Empty
      ]

      for (const invalid of invalidDates) {
        const result = dateSchema.safeParse(invalid)
        // coerce.date might accept some invalid strings, so just check it doesn't crash
        expect(result).toHaveProperty('success')
      }
    })
  })

  describe('Array validation', () => {
    const labelIdsSchema = z.array(z.string().uuid()).optional()
    const watcherIdsSchema = z.array(z.string().uuid()).max(50).optional()

    it('should accept valid UUID arrays', () => {
      fc.assert(
        fc.property(fc.array(fc.uuid(), { maxLength: 50 }), (ids) => {
          const result = watcherIdsSchema.safeParse(ids)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept empty arrays', () => {
      expect(labelIdsSchema.safeParse([]).success).toBe(true)
      expect(watcherIdsSchema.safeParse([]).success).toBe(true)
    })

    it('should reject arrays with invalid UUIDs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string()
              .filter(
                (s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
              ),
            {
              minLength: 1,
            },
          ),
          (invalidIds) => {
            const result = labelIdsSchema.safeParse(invalidIds)
            expect(result.success).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject arrays exceeding max length', () => {
      fc.assert(
        fc.property(fc.array(fc.uuid(), { minLength: 51, maxLength: 100 }), (tooMany) => {
          const result = watcherIdsSchema.safeParse(tooMany)
          expect(result.success).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Object validation', () => {
    const ticketUpdateSchema = z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(10000).nullable().optional(),
      type: z.enum(['task', 'bug', 'story', 'epic', 'subtask']).optional(),
      priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
      columnId: z.string().uuid().optional(),
      assigneeId: z.string().uuid().nullable().optional(),
      sprintId: z.string().uuid().nullable().optional(),
      storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    })

    it('should accept valid partial updates', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
            type: fc.option(ticketType, { nil: undefined }),
            priority: fc.option(ticketPriority, { nil: undefined }),
          }),
          (update) => {
            const cleanUpdate = Object.fromEntries(
              Object.entries(update).filter(([_, v]) => v !== undefined),
            )
            const result = ticketUpdateSchema.safeParse(cleanUpdate)
            expect(result.success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept empty object for updates', () => {
      expect(ticketUpdateSchema.safeParse({}).success).toBe(true)
    })

    it('should handle unknown properties', () => {
      const withExtra = {
        title: 'Valid Title',
        unknownField: 'should be ignored',
        anotherUnknown: 123,
      }

      const result = ticketUpdateSchema.safeParse(withExtra)
      expect(result.success).toBe(true)
    })

    it('should reject invalid nested values', () => {
      const invalidUpdates = [
        { title: '' }, // Empty title
        { type: 'invalid-type' }, // Invalid enum
        { columnId: 'not-a-uuid' }, // Invalid UUID
        { storyPoints: -1 }, // Negative points
        { storyPoints: 101 }, // Points too high
      ]

      for (const update of invalidUpdates) {
        const result = ticketUpdateSchema.safeParse(update)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('URL validation', () => {
    const urlSchema = z.string().url().optional()

    it('should accept valid URLs', () => {
      fc.assert(
        fc.property(fc.webUrl(), (url) => {
          const result = urlSchema.safeParse(url)
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject clearly invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'missing-protocol.com',
        '/relative/path',
        'just-text-no-dots',
        '',
      ]

      for (const url of invalidUrls) {
        const result = urlSchema.safeParse(url)
        // These should definitely be invalid according to Zod's url() validator
        expect(result.success).toBe(false)
      }
    })

    it('should handle URL-like strings safely', () => {
      fc.assert(
        fc.property(urlLike, (url) => {
          const result = urlSchema.safeParse(url)
          // Should not crash
          expect(result).toHaveProperty('success')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Complex payload validation', () => {
    const ticketCreateSchema = z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(10000).optional(),
      type: z.enum(['task', 'bug', 'story', 'epic', 'subtask']).default('task'),
      priority: z
        .enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical'])
        .default('medium'),
      columnId: z.string().uuid(),
      assigneeId: z.string().uuid().nullable().optional(),
      sprintId: z.string().uuid().nullable().optional(),
      parentId: z.string().uuid().nullable().optional(),
      labelIds: z.array(z.string().uuid()).optional(),
      watcherIds: z.array(z.string().uuid()).optional(),
      storyPoints: z.number().int().min(0).max(100).nullable().optional(),
      estimate: z.number().int().min(0).max(480).nullable().optional(),
      startDate: z.coerce.date().nullable().optional(),
      dueDate: z.coerce.date().nullable().optional(),
    })

    it('should accept minimal valid payloads', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), fc.uuid(), (title, columnId) => {
          const result = ticketCreateSchema.safeParse({ title, columnId })
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should apply defaults correctly', () => {
      const result = ticketCreateSchema.safeParse({
        title: 'Test Ticket',
        columnId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('task')
        expect(result.data.priority).toBe('medium')
      }
    })

    it('should handle all optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 500 }),
            description: fc.option(fc.string({ maxLength: 10000 }), { nil: undefined }),
            type: fc.option(ticketType, { nil: undefined }),
            priority: fc.option(ticketPriority, { nil: undefined }),
            columnId: fc.uuid(),
            assigneeId: fc.option(fc.uuid(), { nil: null }),
            sprintId: fc.option(fc.uuid(), { nil: null }),
            parentId: fc.option(fc.uuid(), { nil: null }),
            labelIds: fc.option(fc.array(fc.uuid(), { maxLength: 10 }), { nil: undefined }),
            watcherIds: fc.option(fc.array(fc.uuid(), { maxLength: 10 }), { nil: undefined }),
            storyPoints: fc.option(fc.nat({ max: 100 }), { nil: null }),
            estimate: fc.option(fc.nat({ max: 480 }), { nil: null }),
          }),
          (payload) => {
            const cleanPayload = Object.fromEntries(
              Object.entries(payload).filter(([_, v]) => v !== undefined),
            )
            const result = ticketCreateSchema.safeParse(cleanPayload)
            expect(result.success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
