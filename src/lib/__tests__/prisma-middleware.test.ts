import { describe, expect, it } from 'vitest'
import { MODEL_VALIDATIONS, validateField, validateModelData } from '../prisma-middleware'

describe('Prisma Enum Validation Middleware', () => {
  // ============================================================================
  // validateField
  // ============================================================================

  describe('validateField', () => {
    const nonNullableValidation = {
      allowedValues: ['a', 'b', 'c'] as readonly string[],
      nullable: false,
    }

    const nullableValidation = {
      allowedValues: ['x', 'y'] as readonly string[],
      nullable: true,
    }

    it('should accept valid values', () => {
      expect(() => validateField('Test', 'field', 'a', nonNullableValidation)).not.toThrow()
      expect(() => validateField('Test', 'field', 'b', nonNullableValidation)).not.toThrow()
      expect(() => validateField('Test', 'field', 'c', nonNullableValidation)).not.toThrow()
    })

    it('should reject invalid string values', () => {
      expect(() => validateField('Test', 'field', 'invalid', nonNullableValidation)).toThrow(
        'Invalid value for Test.field: "invalid" is not allowed. Allowed values: a, b, c',
      )
    })

    it('should reject null for non-nullable fields', () => {
      expect(() => validateField('Test', 'field', null, nonNullableValidation)).toThrow(
        'Invalid value for Test.field: null is not allowed. Allowed values: a, b, c',
      )
    })

    it('should accept null for nullable fields', () => {
      expect(() => validateField('Test', 'field', null, nullableValidation)).not.toThrow()
    })

    it('should skip undefined values (field not being set)', () => {
      expect(() => validateField('Test', 'field', undefined, nonNullableValidation)).not.toThrow()
    })

    it('should reject non-string values', () => {
      expect(() => validateField('Test', 'field', 123, nonNullableValidation)).toThrow(
        'Invalid value for Test.field: expected a string, got number',
      )
      expect(() => validateField('Test', 'field', true, nonNullableValidation)).toThrow(
        'Invalid value for Test.field: expected a string, got boolean',
      )
    })

    it('should accept valid values for nullable fields', () => {
      expect(() => validateField('Test', 'field', 'x', nullableValidation)).not.toThrow()
      expect(() => validateField('Test', 'field', 'y', nullableValidation)).not.toThrow()
    })

    it('should reject invalid values for nullable fields', () => {
      expect(() => validateField('Test', 'field', 'z', nullableValidation)).toThrow(
        'Invalid value for Test.field: "z" is not allowed. Allowed values: x, y',
      )
    })
  })

  // ============================================================================
  // validateModelData - Ticket
  // ============================================================================

  describe('Ticket validation', () => {
    describe('type field', () => {
      const validTypes = ['task', 'story', 'bug', 'epic', 'subtask']

      for (const type of validTypes) {
        it(`should accept valid type: ${type}`, () => {
          expect(() => validateModelData('Ticket', 'create', { data: { type } })).not.toThrow()
        })
      }

      it('should reject invalid type', () => {
        expect(() => validateModelData('Ticket', 'create', { data: { type: 'feature' } })).toThrow(
          'Invalid value for Ticket.type: "feature" is not allowed',
        )
      })

      it('should reject null type', () => {
        expect(() => validateModelData('Ticket', 'create', { data: { type: null } })).toThrow(
          'Invalid value for Ticket.type: null is not allowed',
        )
      })
    })

    describe('priority field', () => {
      const validPriorities = ['lowest', 'low', 'medium', 'high', 'highest', 'critical']

      for (const priority of validPriorities) {
        it(`should accept valid priority: ${priority}`, () => {
          expect(() => validateModelData('Ticket', 'create', { data: { priority } })).not.toThrow()
        })
      }

      it('should reject invalid priority', () => {
        expect(() =>
          validateModelData('Ticket', 'create', { data: { priority: 'urgent' } }),
        ).toThrow('Invalid value for Ticket.priority: "urgent" is not allowed')
      })
    })

    describe('resolution field', () => {
      const validResolutions = [
        'Done',
        "Won't Fix",
        'Duplicate',
        'Cannot Reproduce',
        'Incomplete',
        "Won't Do",
      ]

      for (const resolution of validResolutions) {
        it(`should accept valid resolution: ${resolution}`, () => {
          expect(() =>
            validateModelData('Ticket', 'update', { data: { resolution } }),
          ).not.toThrow()
        })
      }

      it('should accept null resolution', () => {
        expect(() =>
          validateModelData('Ticket', 'update', { data: { resolution: null } }),
        ).not.toThrow()
      })

      it('should reject invalid resolution', () => {
        expect(() =>
          validateModelData('Ticket', 'update', { data: { resolution: 'Closed' } }),
        ).toThrow('Invalid value for Ticket.resolution: "Closed" is not allowed')
      })
    })

    it('should validate multiple fields at once', () => {
      expect(() =>
        validateModelData('Ticket', 'create', {
          data: { type: 'task', priority: 'medium', resolution: null },
        }),
      ).not.toThrow()
    })

    it('should fail on first invalid field', () => {
      expect(() =>
        validateModelData('Ticket', 'create', {
          data: { type: 'invalid_type', priority: 'medium' },
        }),
      ).toThrow('Invalid value for Ticket.type')
    })

    it('should skip fields not present in data', () => {
      expect(() =>
        validateModelData('Ticket', 'update', {
          data: { title: 'Updated Title' },
        }),
      ).not.toThrow()
    })
  })

  // ============================================================================
  // validateModelData - Sprint
  // ============================================================================

  describe('Sprint validation', () => {
    const validStatuses = ['planning', 'active', 'completed']

    for (const status of validStatuses) {
      it(`should accept valid status: ${status}`, () => {
        expect(() => validateModelData('Sprint', 'create', { data: { status } })).not.toThrow()
      })
    }

    it('should reject invalid status', () => {
      expect(() => validateModelData('Sprint', 'create', { data: { status: 'archived' } })).toThrow(
        'Invalid value for Sprint.status: "archived" is not allowed',
      )
    })

    it('should reject null status', () => {
      expect(() => validateModelData('Sprint', 'update', { data: { status: null } })).toThrow(
        'Invalid value for Sprint.status: null is not allowed',
      )
    })
  })

  // ============================================================================
  // validateModelData - Invitation
  // ============================================================================

  describe('Invitation validation', () => {
    describe('status field', () => {
      const validStatuses = ['pending', 'accepted', 'expired', 'revoked']

      for (const status of validStatuses) {
        it(`should accept valid status: ${status}`, () => {
          expect(() =>
            validateModelData('Invitation', 'create', { data: { status } }),
          ).not.toThrow()
        })
      }

      it('should reject invalid status', () => {
        expect(() =>
          validateModelData('Invitation', 'create', { data: { status: 'canceled' } }),
        ).toThrow('Invalid value for Invitation.status: "canceled" is not allowed')
      })
    })

    describe('role field', () => {
      const validRoles = ['admin', 'member']

      for (const role of validRoles) {
        it(`should accept valid role: ${role}`, () => {
          expect(() => validateModelData('Invitation', 'create', { data: { role } })).not.toThrow()
        })
      }

      it('should reject invalid role', () => {
        expect(() =>
          validateModelData('Invitation', 'create', { data: { role: 'owner' } }),
        ).toThrow('Invalid value for Invitation.role: "owner" is not allowed')
      })
    })
  })

  // ============================================================================
  // validateModelData - TicketSprintHistory
  // ============================================================================

  describe('TicketSprintHistory validation', () => {
    describe('entryType field', () => {
      const validEntryTypes = ['added', 'carried_over']

      for (const entryType of validEntryTypes) {
        it(`should accept valid entryType: ${entryType}`, () => {
          expect(() =>
            validateModelData('TicketSprintHistory', 'create', { data: { entryType } }),
          ).not.toThrow()
        })
      }

      it('should reject invalid entryType', () => {
        expect(() =>
          validateModelData('TicketSprintHistory', 'create', { data: { entryType: 'moved' } }),
        ).toThrow('Invalid value for TicketSprintHistory.entryType: "moved" is not allowed')
      })
    })

    describe('exitStatus field', () => {
      const validExitStatuses = ['completed', 'carried_over', 'removed']

      for (const exitStatus of validExitStatuses) {
        it(`should accept valid exitStatus: ${exitStatus}`, () => {
          expect(() =>
            validateModelData('TicketSprintHistory', 'update', { data: { exitStatus } }),
          ).not.toThrow()
        })
      }

      it('should accept null exitStatus', () => {
        expect(() =>
          validateModelData('TicketSprintHistory', 'create', { data: { exitStatus: null } }),
        ).not.toThrow()
      })

      it('should reject invalid exitStatus', () => {
        expect(() =>
          validateModelData('TicketSprintHistory', 'update', { data: { exitStatus: 'cancelled' } }),
        ).toThrow('Invalid value for TicketSprintHistory.exitStatus: "cancelled" is not allowed')
      })
    })
  })

  // ============================================================================
  // validateModelData - TicketLink
  // ============================================================================

  describe('TicketLink validation', () => {
    const validLinkTypes = [
      'blocks',
      'is_blocked_by',
      'relates_to',
      'duplicates',
      'is_duplicated_by',
    ]

    for (const linkType of validLinkTypes) {
      it(`should accept valid linkType: ${linkType}`, () => {
        expect(() =>
          validateModelData('TicketLink', 'create', { data: { linkType } }),
        ).not.toThrow()
      })
    }

    it('should reject invalid linkType', () => {
      expect(() =>
        validateModelData('TicketLink', 'create', { data: { linkType: 'depends_on' } }),
      ).toThrow('Invalid value for TicketLink.linkType: "depends_on" is not allowed')
    })
  })

  // ============================================================================
  // Operation type handling
  // ============================================================================

  describe('operation types', () => {
    it('should validate create operations', () => {
      expect(() => validateModelData('Ticket', 'create', { data: { type: 'invalid' } })).toThrow()
    })

    it('should validate update operations', () => {
      expect(() => validateModelData('Ticket', 'update', { data: { type: 'invalid' } })).toThrow()
    })

    it('should validate upsert create data', () => {
      expect(() =>
        validateModelData('Ticket', 'upsert', {
          create: { type: 'invalid' },
          update: { type: 'task' },
        }),
      ).toThrow()
    })

    it('should validate upsert update data', () => {
      expect(() =>
        validateModelData('Ticket', 'upsert', {
          create: { type: 'task' },
          update: { type: 'invalid' },
        }),
      ).toThrow()
    })

    it('should pass upsert with valid create and update data', () => {
      expect(() =>
        validateModelData('Ticket', 'upsert', {
          create: { type: 'task' },
          update: { type: 'bug' },
        }),
      ).not.toThrow()
    })

    it('should validate createMany operations with array data', () => {
      expect(() =>
        validateModelData('Ticket', 'createMany', {
          data: [{ type: 'task' }, { type: 'invalid' }],
        }),
      ).toThrow('Invalid value for Ticket.type: "invalid" is not allowed')
    })

    it('should pass createMany with all valid data', () => {
      expect(() =>
        validateModelData('Ticket', 'createMany', {
          data: [{ type: 'task' }, { type: 'bug' }],
        }),
      ).not.toThrow()
    })

    it('should validate updateMany operations', () => {
      expect(() =>
        validateModelData('Ticket', 'updateMany', { data: { priority: 'invalid' } }),
      ).toThrow()
    })

    it('should not validate read operations', () => {
      // findMany, findFirst, etc. should not trigger validation
      expect(() =>
        validateModelData('Ticket', 'findMany', { where: { type: 'anything' } }),
      ).not.toThrow()
    })

    it('should not validate delete operations', () => {
      expect(() => validateModelData('Ticket', 'delete', { where: { id: '123' } })).not.toThrow()
    })
  })

  // ============================================================================
  // Unregistered models
  // ============================================================================

  describe('unregistered models', () => {
    it('should pass through models without validation rules', () => {
      expect(() =>
        validateModelData('User', 'create', { data: { name: 'anything' } }),
      ).not.toThrow()
    })

    it('should pass through unknown models', () => {
      expect(() =>
        validateModelData('NonExistentModel', 'create', { data: { field: 'value' } }),
      ).not.toThrow()
    })
  })

  // ============================================================================
  // MODEL_VALIDATIONS completeness
  // ============================================================================

  describe('MODEL_VALIDATIONS', () => {
    it('should have validations for Ticket model', () => {
      expect(MODEL_VALIDATIONS.Ticket).toBeDefined()
      expect(MODEL_VALIDATIONS.Ticket.type).toBeDefined()
      expect(MODEL_VALIDATIONS.Ticket.priority).toBeDefined()
      expect(MODEL_VALIDATIONS.Ticket.resolution).toBeDefined()
    })

    it('should have validations for Sprint model', () => {
      expect(MODEL_VALIDATIONS.Sprint).toBeDefined()
      expect(MODEL_VALIDATIONS.Sprint.status).toBeDefined()
    })

    it('should have validations for Invitation model', () => {
      expect(MODEL_VALIDATIONS.Invitation).toBeDefined()
      expect(MODEL_VALIDATIONS.Invitation.status).toBeDefined()
      expect(MODEL_VALIDATIONS.Invitation.role).toBeDefined()
    })

    it('should have validations for TicketSprintHistory model', () => {
      expect(MODEL_VALIDATIONS.TicketSprintHistory).toBeDefined()
      expect(MODEL_VALIDATIONS.TicketSprintHistory.entryType).toBeDefined()
      expect(MODEL_VALIDATIONS.TicketSprintHistory.exitStatus).toBeDefined()
    })

    it('should have validations for TicketLink model', () => {
      expect(MODEL_VALIDATIONS.TicketLink).toBeDefined()
      expect(MODEL_VALIDATIONS.TicketLink.linkType).toBeDefined()
    })

    it('should mark Ticket.resolution as nullable', () => {
      expect(MODEL_VALIDATIONS.Ticket.resolution.nullable).toBe(true)
    })

    it('should mark Ticket.type as non-nullable', () => {
      expect(MODEL_VALIDATIONS.Ticket.type.nullable).toBe(false)
    })

    it('should mark TicketSprintHistory.exitStatus as nullable', () => {
      expect(MODEL_VALIDATIONS.TicketSprintHistory.exitStatus.nullable).toBe(true)
    })

    it('should mark TicketSprintHistory.entryType as non-nullable', () => {
      expect(MODEL_VALIDATIONS.TicketSprintHistory.entryType.nullable).toBe(false)
    })
  })

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty data object', () => {
      expect(() => validateModelData('Ticket', 'create', { data: {} })).not.toThrow()
    })

    it('should handle missing data key', () => {
      expect(() => validateModelData('Ticket', 'create', {})).not.toThrow()
    })

    it('should handle case-sensitive values', () => {
      expect(() => validateModelData('Ticket', 'create', { data: { type: 'Task' } })).toThrow(
        'Invalid value for Ticket.type: "Task" is not allowed',
      )

      expect(() => validateModelData('Ticket', 'create', { data: { type: 'TASK' } })).toThrow(
        'Invalid value for Ticket.type: "TASK" is not allowed',
      )
    })

    it('should handle empty string values', () => {
      expect(() => validateModelData('Ticket', 'create', { data: { type: '' } })).toThrow(
        'Invalid value for Ticket.type: "" is not allowed',
      )
    })

    it('should handle whitespace-only values', () => {
      expect(() => validateModelData('Ticket', 'create', { data: { type: ' task ' } })).toThrow(
        'Invalid value for Ticket.type: " task " is not allowed',
      )
    })
  })
})
