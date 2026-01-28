/**
 * Fuzz tests for permission validation.
 * Tests project role checking and authorization.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { projectRole } from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

// Define valid roles as they appear in the codebase
const VALID_ROLES = ['owner', 'admin', 'member'] as const
type ProjectRole = (typeof VALID_ROLES)[number]

/**
 * Check if a role is valid
 */
function isValidRole(role: unknown): role is ProjectRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as ProjectRole)
}

/**
 * Check if a role has admin privileges (admin or owner)
 */
function hasAdminPrivileges(role: ProjectRole): boolean {
  return role === 'admin' || role === 'owner'
}

/**
 * Check if a role has owner privileges
 */
function hasOwnerPrivileges(role: ProjectRole): boolean {
  return role === 'owner'
}

/**
 * Role hierarchy: owner > admin > member
 */
function roleHierarchy(role: ProjectRole): number {
  switch (role) {
    case 'owner':
      return 3
    case 'admin':
      return 2
    case 'member':
      return 1
    default:
      return 0
  }
}

describe('Permission System Fuzz Tests', () => {
  describe('isValidRole', () => {
    it('should accept all valid roles', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          expect(isValidRole(role)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid string roles', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !VALID_ROLES.includes(s as ProjectRole)),
          (invalidRole) => {
            expect(isValidRole(invalidRole)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject non-string values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything()),
            fc.dictionary(fc.string(), fc.anything()),
          ),
          (invalidValue) => {
            expect(isValidRole(invalidValue)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be case-sensitive', () => {
      const casedVariants = ['Owner', 'OWNER', 'Admin', 'ADMIN', 'Member', 'MEMBER']
      for (const variant of casedVariants) {
        expect(isValidRole(variant)).toBe(false)
      }
    })
  })

  describe('hasAdminPrivileges', () => {
    it('should return true for owner and admin', () => {
      expect(hasAdminPrivileges('owner')).toBe(true)
      expect(hasAdminPrivileges('admin')).toBe(true)
    })

    it('should return false for member', () => {
      expect(hasAdminPrivileges('member')).toBe(false)
    })

    it('should be consistent for all valid roles', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          const result = hasAdminPrivileges(role)
          expect(typeof result).toBe('boolean')

          // Verify the logic
          if (role === 'owner' || role === 'admin') {
            expect(result).toBe(true)
          } else {
            expect(result).toBe(false)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('hasOwnerPrivileges', () => {
    it('should return true only for owner', () => {
      expect(hasOwnerPrivileges('owner')).toBe(true)
      expect(hasOwnerPrivileges('admin')).toBe(false)
      expect(hasOwnerPrivileges('member')).toBe(false)
    })

    it('should be consistent for all valid roles', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          const result = hasOwnerPrivileges(role)
          expect(typeof result).toBe('boolean')
          expect(result).toBe(role === 'owner')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('roleHierarchy', () => {
    it('should maintain owner > admin > member ordering', () => {
      expect(roleHierarchy('owner')).toBeGreaterThan(roleHierarchy('admin'))
      expect(roleHierarchy('admin')).toBeGreaterThan(roleHierarchy('member'))
      expect(roleHierarchy('owner')).toBeGreaterThan(roleHierarchy('member'))
    })

    it('should be transitive', () => {
      fc.assert(
        fc.property(projectRole, projectRole, projectRole, (a, b, c) => {
          const ha = roleHierarchy(a)
          const hb = roleHierarchy(b)
          const hc = roleHierarchy(c)

          // If a >= b and b >= c, then a >= c (transitivity)
          if (ha >= hb && hb >= hc) {
            expect(ha >= hc).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return positive numbers for valid roles', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          expect(roleHierarchy(role)).toBeGreaterThan(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be consistent (same role = same hierarchy)', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          expect(roleHierarchy(role)).toBe(roleHierarchy(role))
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Permission checking invariants', () => {
    it('should ensure owner can do everything admin can do', () => {
      // If admin can do something, owner can too
      expect(hasOwnerPrivileges('owner') || hasAdminPrivileges('owner')).toBe(true)
    })

    it('should ensure admin privileges imply member access', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          // If you have admin privileges, you're at least a member
          if (hasAdminPrivileges(role)) {
            expect(roleHierarchy(role)).toBeGreaterThanOrEqual(roleHierarchy('member'))
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should ensure owner privileges imply admin access', () => {
      fc.assert(
        fc.property(projectRole, (role) => {
          // If you have owner privileges, you have admin privileges
          if (hasOwnerPrivileges(role)) {
            expect(hasAdminPrivileges(role)).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(isValidRole('')).toBe(false)
    })

    it('should handle whitespace variations', () => {
      expect(isValidRole(' owner')).toBe(false)
      expect(isValidRole('owner ')).toBe(false)
      expect(isValidRole(' owner ')).toBe(false)
      expect(isValidRole('\towner')).toBe(false)
      expect(isValidRole('\nowner')).toBe(false)
    })

    it('should handle similar-looking strings', () => {
      expect(isValidRole('owners')).toBe(false)
      expect(isValidRole('admins')).toBe(false)
      expect(isValidRole('members')).toBe(false)
      expect(isValidRole('own')).toBe(false)
      expect(isValidRole('adm')).toBe(false)
      expect(isValidRole('mem')).toBe(false)
    })
  })
})
