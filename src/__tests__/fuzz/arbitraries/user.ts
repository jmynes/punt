/**
 * User-related arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'

/**
 * Valid username characters according to the schema
 */
const validUsernameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'

/**
 * Valid username arbitrary (3-30 chars, alphanumeric + underscore + hyphen)
 */
export const validUsername = fc
  .array(fc.constantFrom(...validUsernameChars.split('')), { minLength: 3, maxLength: 30 })
  .map((chars) => chars.join(''))

/**
 * Invalid username arbitrary - various ways a username can be invalid
 */
export const invalidUsername = fc.oneof(
  // Too short (0-2 chars)
  fc
    .array(fc.constantFrom(...validUsernameChars.split('')), { minLength: 0, maxLength: 2 })
    .map((chars) => chars.join('')),
  // Too long (31+ chars)
  fc
    .array(fc.constantFrom(...validUsernameChars.split('')), { minLength: 31, maxLength: 100 })
    .map((chars) => chars.join('')),
  // Contains invalid characters
  fc
    .string({ minLength: 3, maxLength: 30 })
    .filter((s) => /[^a-zA-Z0-9_-]/.test(s)),
  // Unicode lookalikes
  fc.constantFrom(
    'аdmin', // Cyrillic 'а'
    'usеr', // Cyrillic 'е'
    'rооt', // Cyrillic 'о'
    'ᴀdmin', // Small caps
    'admin\u200B', // Zero-width space
    'admin\u0000', // Null byte
  ),
  // Special characters
  fc.constantFrom(
    'user name',
    'user@name',
    'user.name',
    'user/name',
    'user\\name',
    "user'name",
    'user"name',
    '<script>',
    '../path',
  ),
  // Empty
  fc.constant(''),
)

/**
 * Username arbitrary that can be either valid or invalid
 */
export const usernameArb = fc.oneof(validUsername, invalidUsername)

/**
 * User ID arbitrary (UUID-like)
 */
export const userId = fc.uuid()

/**
 * User summary object arbitrary
 */
export const userSummary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  avatar: fc.option(fc.webUrl(), { nil: null }),
})

/**
 * Project role arbitrary
 */
export const projectRole = fc.constantFrom('owner', 'admin', 'member')

/**
 * Project member arbitrary
 */
export const projectMember = fc.record({
  userId: fc.uuid(),
  projectId: fc.uuid(),
  role: projectRole,
  user: userSummary,
})
