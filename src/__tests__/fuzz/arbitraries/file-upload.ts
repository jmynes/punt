/**
 * File upload-related arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'

/**
 * Allowed image MIME types
 */
export const allowedImageTypes = fc.constantFrom(
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
)

/**
 * Allowed video MIME types
 */
export const allowedVideoTypes = fc.constantFrom(
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
)

/**
 * Allowed document MIME types
 */
export const allowedDocumentTypes = fc.constantFrom(
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
)

/**
 * All allowed MIME types
 */
export const allowedMimeTypes = fc.oneof(allowedImageTypes, allowedVideoTypes, allowedDocumentTypes)

/**
 * Blocked MIME types (SVG and others)
 */
export const blockedMimeTypes = fc.constantFrom(
  'image/svg+xml',
  'image/svg',
  'text/xml',
  'application/xml',
  'text/html',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/x-httpd-php',
  'application/x-php',
  'text/x-php',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-executable',
  'application/x-msdos-program',
)

/**
 * Random/unknown MIME types
 */
export const randomMimeTypes = fc.oneof(
  fc.string().map((s) => `application/${s}`),
  fc.string().map((s) => `${s}/octet-stream`),
  fc.constantFrom(
    '',
    'invalid',
    'application/octet-stream',
    'application/unknown',
    'foo/bar',
    'image/unknown',
  ),
)

/**
 * Any MIME type (valid, blocked, or random)
 */
export const anyMimeType = fc.oneof(allowedMimeTypes, blockedMimeTypes, randomMimeTypes)

/**
 * File size in bytes
 */
export const fileSize = fc.oneof(
  // Small files
  fc.nat({ max: 1024 }), // Up to 1KB
  // Medium files
  fc.nat({ max: 10 * 1024 * 1024 }), // Up to 10MB
  // Large files (potentially over limit)
  fc.integer({ min: 10 * 1024 * 1024, max: 500 * 1024 * 1024 }), // 10MB - 500MB
  // Edge cases
  fc.constantFrom(0, 1, -1, Number.MAX_SAFE_INTEGER, Number.NaN, Number.POSITIVE_INFINITY),
)

/**
 * File name arbitrary
 */
export const fileName = fc.oneof(
  // Normal names
  fc
    .string({ minLength: 1, maxLength: 100 })
    .map((s) => `${s}.txt`),
  fc.constantFrom('document.pdf', 'image.jpg', 'video.mp4', 'file.docx', 'spreadsheet.xlsx'),
  // Dangerous names
  fc.constantFrom(
    '../../../etc/passwd',
    '..\\..\\windows\\system32',
    'file.exe',
    'script.js',
    'page.html',
    'file.php',
    '.htaccess',
    'file\x00.txt',
    'file.svg',
    '<script>.txt',
    'file name with spaces.txt',
    '文件名.txt',
  ),
  // Edge cases
  fc.constantFrom('', '.', '..', '...', '.hidden', `a${'a'.repeat(300)}`),
)

/**
 * File upload data arbitrary
 */
export const fileUpload = fc.record({
  name: fileName,
  type: anyMimeType,
  size: fileSize,
})

/**
 * System settings for upload configuration
 */
export const uploadSettings = fc.record({
  maxImageSizeMB: fc.integer({ min: 1, max: 100 }),
  maxVideoSizeMB: fc.integer({ min: 1, max: 500 }),
  maxDocumentSizeMB: fc.integer({ min: 1, max: 100 }),
  maxAttachmentsPerTicket: fc.integer({ min: 1, max: 50 }),
  allowedImageTypes: fc.constant(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  allowedVideoTypes: fc.constant(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']),
  allowedDocumentTypes: fc.constant([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ]),
})
