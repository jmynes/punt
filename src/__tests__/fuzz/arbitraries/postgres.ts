/**
 * PostgreSQL-specific arbitraries for fuzz testing.
 * Generators for native enums, JSON coercion, permissions, ILIKE, and case-variant usernames.
 */
import * as fc from 'fast-check'
import { ISSUE_TYPES, LINK_TYPES, PRIORITIES } from '@/types'

// ============================================================================
// Enum arbitraries — all 8 PostgreSQL native enums
// ============================================================================

export const pgTicketType = fc.constantFrom(...ISSUE_TYPES)
export const pgTicketPriority = fc.constantFrom(...PRIORITIES)
export const pgSprintStatus = fc.constantFrom('planning', 'active', 'completed')
export const pgInvitationStatus = fc.constantFrom('pending', 'accepted', 'expired', 'revoked')
export const pgInvitationRole = fc.constantFrom('admin', 'member')
export const pgSprintEntryType = fc.constantFrom('added', 'carried_over')
export const pgSprintExitStatus = fc.constantFrom('completed', 'carried_over', 'removed')
export const pgLinkType = fc.constantFrom(...LINK_TYPES)

// ============================================================================
// JSON coercion inputs
// ============================================================================

/** Already-parsed array (PostgreSQL native Json) */
export const nativeJsonArray = fc.array(fc.string(), { minLength: 0, maxLength: 10 })

/** Legacy JSON-stringified array (from older SQLite exports) */
export const legacyJsonStringArray = nativeJsonArray.map((arr) => JSON.stringify(arr))

/** Either native or legacy format */
export const jsonOrLegacyArray = fc.oneof(nativeJsonArray, legacyJsonStringArray)

/** Garbage inputs that coercion functions must handle without throwing */
export const garbageJsonInput = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.boolean(),
  // Unparseable strings
  fc.constantFrom('{invalid', '[broken', 'not-json', '', '{"key": "value"}', '42', 'true'),
  // Wrong-type JSON (object, number, boolean as strings)
  fc.constant('{"a":1}'),
  fc.constant('123'),
  fc.constant('false'),
)

// ============================================================================
// Permission values
// ============================================================================

const ALL_PERMISSION_VALUES = [
  'project.settings',
  'project.delete',
  'members.invite',
  'members.manage',
  'members.admin',
  'board.manage',
  'tickets.create',
  'tickets.manage_own',
  'tickets.manage_any',
  'sprints.manage',
  'labels.manage',
  'comments.manage_any',
  'attachments.manage_any',
] as const

/** Subset of valid permissions */
export const validPermissionsArray = fc.subarray([...ALL_PERMISSION_VALUES], { minLength: 0 })

/** Mix of valid and invalid permission entries */
export const mixedPermissionsArray = fc.array(
  fc.oneof(fc.constantFrom(...ALL_PERMISSION_VALUES), fc.string({ minLength: 1, maxLength: 30 })),
  { minLength: 0, maxLength: 20 },
)

/** Legacy stringified permissions (from older exports) */
export const legacyPermissionsString = validPermissionsArray.map((arr) => JSON.stringify(arr))

// ============================================================================
// ILIKE-special strings
// ============================================================================

/** Strings that contain characters with special meaning in PostgreSQL LIKE/ILIKE */
export const likeInjectionString = fc.oneof(
  // Strings with % wildcard
  fc
    .array(fc.constantFrom('%', '_', '\\', 'a', 'b', ' '), { minLength: 1, maxLength: 50 })
    .map((chars) => chars.join('')),
  // Targeted injections
  fc.constantFrom(
    '%',
    '%%',
    '_',
    '__',
    '\\',
    '%admin%',
    '_a_b_c_',
    '\\%',
    '\\_',
    '100%',
    'user_name',
    'test\\path',
    '%_%',
    '\\\\',
  ),
  // Random strings mixed with specials
  fc
    .tuple(fc.string({ minLength: 0, maxLength: 20 }), fc.constantFrom('%', '_', '\\'))
    .map(([s, c]) => `${s}${c}${s}`),
)

// ============================================================================
// Case-variant usernames
// ============================================================================

const alphaChars = 'abcdefghijklmnopqrstuvwxyz'

/** Generate { original, variant } pairs that differ only in letter case */
export const caseVariantUsername = fc
  .array(fc.constantFrom(...alphaChars.split(''), ...'0123456789_-'.split('')), {
    minLength: 3,
    maxLength: 20,
  })
  .map((chars) => chars.join(''))
  .chain((original) => {
    // Generate a case-different variant
    return fc.constantFrom('upper', 'lower', 'random').map((strategy) => {
      let variant: string
      if (strategy === 'upper') {
        variant = original.toUpperCase()
      } else if (strategy === 'lower') {
        variant = original.toLowerCase()
      } else {
        // Random case flip
        variant = original
          .split('')
          .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
          .join('')
      }
      return { original, variant }
    })
  })
