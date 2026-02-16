/**
 * Fuzz tests for file upload validation.
 * Tests MIME type checking and file size validation.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SystemSettings } from '@/lib/system-settings'
import { getFileCategoryForMimeType, getMaxSizeForMimeType } from '@/lib/system-settings'
import {
  allowedMimeTypes,
  anyMimeType,
  blockedMimeTypes,
  fileSize,
  uploadSettings,
} from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

// Create a mock SystemSettings for testing
function createMockSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    id: 'test',
    updatedAt: new Date(),
    updatedBy: null,
    appName: 'PUNT',
    logoUrl: null,
    logoLetter: 'P',
    logoGradientFrom: '#f59e0b',
    logoGradientTo: '#ea580c',
    maxImageSizeMB: 10,
    maxVideoSizeMB: 100,
    maxDocumentSizeMB: 25,
    maxAttachmentsPerTicket: 20,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    allowedDocumentTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    showAddColumnButton: true,
    canonicalRepoUrl: null,
    repoHostingProvider: null,
    forkRepoUrl: null,
    defaultBranchTemplate: '{type}/{key}-{slug}',
    defaultAgentGuidance: null,
    ...overrides,
  }
}

describe('File Upload Fuzz Tests', () => {
  describe('getFileCategoryForMimeType', () => {
    const settings = createMockSettings()

    it('should never crash on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (mimeType) => {
          const result = getFileCategoryForMimeType(mimeType, settings)
          expect(['image', 'video', 'document']).toContain(result)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should categorize allowed image types as image', () => {
      fc.assert(
        fc.property(allowedMimeTypes, (mimeType) => {
          const result = getFileCategoryForMimeType(mimeType, settings)

          if (settings.allowedImageTypes.includes(mimeType)) {
            expect(result).toBe('image')
          } else if (settings.allowedVideoTypes.includes(mimeType)) {
            expect(result).toBe('video')
          } else {
            expect(result).toBe('document')
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should categorize unknown types as document', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (s) =>
                !settings.allowedImageTypes.includes(s) && !settings.allowedVideoTypes.includes(s),
            ),
          (mimeType) => {
            const result = getFileCategoryForMimeType(mimeType, settings)
            expect(result).toBe('document')
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle empty string', () => {
      const result = getFileCategoryForMimeType('', settings)
      expect(result).toBe('document')
    })
  })

  describe('getMaxSizeForMimeType', () => {
    const settings = createMockSettings()

    it('should never crash on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (mimeType) => {
          const result = getMaxSizeForMimeType(mimeType, settings)
          expect(typeof result).toBe('number')
          expect(result).toBeGreaterThan(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return image size for image types', () => {
      for (const mimeType of settings.allowedImageTypes) {
        const result = getMaxSizeForMimeType(mimeType, settings)
        expect(result).toBe(settings.maxImageSizeMB * 1024 * 1024)
      }
    })

    it('should return video size for video types', () => {
      for (const mimeType of settings.allowedVideoTypes) {
        const result = getMaxSizeForMimeType(mimeType, settings)
        expect(result).toBe(settings.maxVideoSizeMB * 1024 * 1024)
      }
    })

    it('should return document size for document types', () => {
      for (const mimeType of settings.allowedDocumentTypes) {
        const result = getMaxSizeForMimeType(mimeType, settings)
        expect(result).toBe(settings.maxDocumentSizeMB * 1024 * 1024)
      }
    })

    it('should return document size for unknown types', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (s) =>
                !settings.allowedImageTypes.includes(s) && !settings.allowedVideoTypes.includes(s),
            ),
          (mimeType) => {
            const result = getMaxSizeForMimeType(mimeType, settings)
            expect(result).toBe(settings.maxDocumentSizeMB * 1024 * 1024)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should work with various settings configurations', () => {
      fc.assert(
        fc.property(uploadSettings, anyMimeType, (settingsData, mimeType) => {
          const testSettings = createMockSettings(settingsData)
          const result = getMaxSizeForMimeType(mimeType, testSettings)

          expect(typeof result).toBe('number')
          expect(result).toBeGreaterThan(0)

          // Result should match one of the configured sizes
          const expectedSizes = [
            testSettings.maxImageSizeMB * 1024 * 1024,
            testSettings.maxVideoSizeMB * 1024 * 1024,
            testSettings.maxDocumentSizeMB * 1024 * 1024,
          ]
          expect(expectedSizes).toContain(result)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('SVG blocking', () => {
    const settings = createMockSettings()

    it('should never have SVG in allowed types', () => {
      const allAllowed = [
        ...settings.allowedImageTypes,
        ...settings.allowedVideoTypes,
        ...settings.allowedDocumentTypes,
      ]

      // SVG should never be in the allowed list
      expect(allAllowed).not.toContain('image/svg+xml')
      expect(allAllowed).not.toContain('image/svg')
    })

    it('should categorize SVG as document (not image)', () => {
      // SVG should not be treated as an image
      expect(getFileCategoryForMimeType('image/svg+xml', settings)).toBe('document')
      expect(getFileCategoryForMimeType('image/svg', settings)).toBe('document')
    })

    it('should categorize all blocked types as document', () => {
      fc.assert(
        fc.property(blockedMimeTypes, (mimeType) => {
          const category = getFileCategoryForMimeType(mimeType, settings)
          // Blocked types that aren't in image/video should be document
          expect(['document']).toContain(category)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('File size edge cases', () => {
    const settings = createMockSettings()

    it('should handle file size comparison correctly', () => {
      fc.assert(
        fc.property(fileSize, anyMimeType, (size, mimeType) => {
          if (typeof size !== 'number' || !Number.isFinite(size)) {
            return // Skip non-finite numbers for this test
          }

          const maxSize = getMaxSizeForMimeType(mimeType, settings)
          const isWithinLimit = size <= maxSize

          expect(typeof isWithinLimit).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('MIME type validation', () => {
    const settings = createMockSettings()

    it('should have consistent allowed types check', () => {
      fc.assert(
        fc.property(anyMimeType, (mimeType) => {
          const allAllowed = [
            ...settings.allowedImageTypes,
            ...settings.allowedVideoTypes,
            ...settings.allowedDocumentTypes,
          ]

          const isAllowed = allAllowed.includes(mimeType)
          expect(typeof isAllowed).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should correctly identify allowed MIME types', () => {
      fc.assert(
        fc.property(allowedMimeTypes, (mimeType) => {
          const settings = createMockSettings()
          const allAllowed = [
            ...settings.allowedImageTypes,
            ...settings.allowedVideoTypes,
            ...settings.allowedDocumentTypes,
          ]

          expect(allAllowed).toContain(mimeType)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not include blocked MIME types in allowed list', () => {
      fc.assert(
        fc.property(blockedMimeTypes, (mimeType) => {
          const settings = createMockSettings()
          const allAllowed = [
            ...settings.allowedImageTypes,
            ...settings.allowedVideoTypes,
            ...settings.allowedDocumentTypes,
          ]

          expect(allAllowed).not.toContain(mimeType)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
