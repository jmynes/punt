/**
 * Security-focused primitive arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'

/**
 * SQL injection patterns
 */
const sqlInjectionPatterns = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  '1; SELECT * FROM users',
  "' UNION SELECT * FROM users --",
  "1' AND 1=1 --",
  "admin'--",
  "' OR ''='",
  "1' OR 1=1#",
  "' OR 1=1/*",
  "'-'",
  "' '",
  'OR 1=1',
  "'; EXEC xp_cmdshell('dir'); --",
]

/**
 * XSS attack patterns
 */
const xssPatterns = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
  "javascript:alert('XSS')",
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '{{constructor.constructor("alert(1)")()}}',
  '<math><maction xlink:href="javascript:alert(1)">click',
  '"><img src=x onerror=alert(1)//",',
  '<div style="background:url(javascript:alert(1))">',
  "'-alert(1)-'",
]

/**
 * Path traversal patterns
 */
const pathTraversalPatterns = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32',
  '/etc/passwd',
  'C:\\Windows\\System32',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2f',
  '%252e%252e%252f',
  '..%c0%af',
  '..%255c',
  '..%5c..%5c',
]

/**
 * Null byte and control character patterns
 */
const controlCharPatterns = [
  'test\x00.txt',
  'test\x00hidden',
  '\x00\x01\x02\x03',
  'file.txt\x00.exe',
  '\r\n\r\n',
  '\t\t\t',
  '\x7f',
  '\x1b[31mcolored\x1b[0m',
]

/**
 * Unicode edge cases
 */
const unicodePatterns = [
  '\u0000', // Null
  '\uFFFF', // Max BMP
  '\uD800', // Lone high surrogate
  '\uDC00', // Lone low surrogate
  '\uFEFF', // BOM
  '\u202E', // RTL override
  '\u200B', // Zero-width space
  'café', // Composed
  'cafe\u0301', // Decomposed
  '𝕳𝖊𝖑𝖑𝖔', // Mathematical script
  '안녕하세요', // Korean
  '日本語', // Japanese
  '🎉🚀💻', // Emoji
  '\u200D', // ZWJ
]

/**
 * Arbitrary that generates malicious strings for security testing
 */
export const maliciousString = fc.oneof(
  fc.constantFrom(...sqlInjectionPatterns),
  fc.constantFrom(...xssPatterns),
  fc.constantFrom(...pathTraversalPatterns),
  fc.constantFrom(...controlCharPatterns),
  fc.constantFrom(...unicodePatterns),
  // Mix with random strings
  fc
    .string()
    .map((s) => `${s}<script>alert(1)</script>${s}`),
  fc.string().map((s) => `${s}'; DROP TABLE users; --`),
  // Very long strings
  fc.string({ minLength: 1000, maxLength: 10000 }),
  // Empty and whitespace
  fc.constantFrom('', ' ', '\t', '\n', '\r\n'),
)

/**
 * URL-like strings for testing redirect validation
 */
export const urlLike = fc.oneof(
  // Valid relative paths
  fc.constantFrom('/dashboard', '/projects/123', '/settings', '/'),
  fc.string({ minLength: 1 }).map((s) => `/${s.replace(/[^a-zA-Z0-9-_/]/g, '')}`),
  // Protocol-relative URLs (should be blocked)
  fc.constantFrom('//evil.com', '//google.com/path', '///test'),
  fc.string().map((s) => `//${s}.com`),
  // Absolute URLs (should be blocked)
  fc.constantFrom('http://evil.com', 'https://attacker.com', 'ftp://server.com'),
  fc.string().map((s) => `https://${s}.com/path`),
  // javascript: and data: URLs (should be blocked)
  fc.constantFrom(
    "javascript:alert('XSS')",
    'javascript:void(0)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'JAVASCRIPT:alert(1)',
    'JaVaScRiPt:alert(1)',
    'DATA:text/html,test',
  ),
  // Backslash bypasses (should be blocked)
  fc.constantFrom('/\\evil.com', '\\\\evil.com', '/\\\\path'),
  // Edge cases
  fc.constantFrom(
    '',
    ' ',
    '/',
    '/?',
    '/#',
    '?callback=evil',
    '#hash',
    '../../../etc/passwd',
    '..\\..\\windows',
  ),
  // Mixed
  fc
    .string()
    .map((s) => s.slice(0, 50)),
)

/**
 * Password strings for validation testing
 */
export const passwordString = fc.oneof(
  // Too short
  fc.string({ minLength: 0, maxLength: 11 }),
  // No uppercase - generate lowercase + numbers only
  fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 12,
      maxLength: 20,
    })
    .map((chars) => chars.join('')),
  // No lowercase - generate uppercase + numbers only
  fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 12,
      maxLength: 20,
    })
    .map((chars) => chars.join('')),
  // No numbers - generate letters only
  fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      minLength: 12,
      maxLength: 20,
    })
    .map((chars) => chars.join('')),
  // Valid passwords
  fc
    .string({ minLength: 12, maxLength: 128 })
    .map((s) => `Aa1${s}`),
  // Edge cases
  fc.constantFrom(
    '', // Empty
    'a'.repeat(12), // Only lowercase
    'A'.repeat(12), // Only uppercase
    '1'.repeat(12), // Only numbers
    'Password123!', // Classic
    'ValidPass123', // Valid
    ' '.repeat(12), // Only spaces
    '🔑🔒🔐🗝️', // Emoji
  ),
  // Very long
  fc.string({ minLength: 100, maxLength: 1000 }),
  // With special characters
  fc
    .string()
    .map((s) => `Aa1!@#$%^&*()${s}`),
)

/**
 * Email-like strings for validation testing
 */
export const emailLike = fc.oneof(
  // Valid emails
  fc.emailAddress(),
  fc.constantFrom('user@example.com', 'test.user@domain.co.uk', 'a@b.co', 'user+tag@example.com'),
  // Invalid emails
  fc.constantFrom(
    '',
    'invalid',
    '@nodomain',
    'no@tld',
    'spaces in@email.com',
    'missing@.com',
    '@.com',
    'double@@at.com',
    'a@b@c.com',
  ),
  // Edge cases
  fc
    .string()
    .filter((s) => !s.includes('@')),
  fc.string().map((s) => `${s}@example.com`),
)

/**
 * JSON-like arbitrary values for localStorage corruption testing
 */
export const corruptedJson = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.boolean(),
  fc.string(),
  fc.array(fc.anything()),
  fc.dictionary(fc.string(), fc.anything()),
  // Invalid JSON strings
  fc.constantFrom('{invalid}', '[1,2,', '{"key":}', 'undefined', 'NaN', 'Infinity'),
)
