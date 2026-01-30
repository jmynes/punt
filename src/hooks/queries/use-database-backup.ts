'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ImportResult } from '@/lib/database-import'
import { isDemoMode } from '@/lib/demo'

export interface ExportOptions {
  password?: string
  includeAttachments?: boolean
  includeAvatars?: boolean
  confirmPassword: string
}

/**
 * Export the database as JSON or ZIP
 */
export function useExportDatabase() {
  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      if (isDemoMode()) {
        toast.info('Database export is disabled in demo mode')
        return null
      }

      const res = await fetch('/api/admin/database/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export database')
      }

      // Get the filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || 'punt-backup.zip'

      // Get content type to determine file type
      const contentType = res.headers.get('Content-Type') || ''
      const isZip = contentType.includes('zip')

      // Get the content as blob for ZIP or text for JSON
      if (isZip) {
        const blob = await res.blob()
        return { blob, filename, isZip: true }
      }

      const content = await res.text()
      return { content, filename, isZip: false }
    },
    onSuccess: (data) => {
      if (!data) return

      // Trigger download
      let blob: Blob
      if (data.isZip && 'blob' in data && data.blob) {
        blob = data.blob
      } else if ('content' in data && data.content) {
        blob = new Blob([data.content], { type: 'application/json' })
      } else {
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Database exported successfully')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

export interface ImportDatabaseParams {
  content: string // Base64 encoded
  decryptionPassword?: string
  username: string
  password: string
  confirmText: string
}

/**
 * Import a database backup
 */
export function useImportDatabase() {
  return useMutation({
    mutationFn: async (params: ImportDatabaseParams): Promise<ImportResult> => {
      if (isDemoMode()) {
        toast.info('Database import is disabled in demo mode')
        throw new Error('Demo mode')
      }

      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to import database')
      }

      return res.json()
    },
    onSuccess: (result) => {
      const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0)
      const fileInfo =
        result.files.attachmentsRestored + result.files.avatarsRestored > 0
          ? `, ${result.files.attachmentsRestored + result.files.avatarsRestored} files`
          : ''
      toast.success(`Database imported successfully (${total} records${fileInfo})`)
    },
    onError: (err) => {
      if (err.message !== 'Demo mode') {
        toast.error(err.message)
      }
    },
  })
}

/**
 * Convert a File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Result is data:mime;base64,XXXX - extract just the base64 part
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Check if an export file is encrypted (client-side check for JSON files)
 */
export function checkIfExportEncrypted(content: string): boolean {
  try {
    const parsed = JSON.parse(content)
    return parsed?.encrypted === true
  } catch {
    return false
  }
}

/**
 * Check if content is a ZIP file (by checking first bytes)
 */
export function isZipContent(base64Content: string): boolean {
  // ZIP magic bytes in base64: "UEsD" corresponds to 0x50 0x4B 0x03 0x04
  return base64Content.startsWith('UEsD')
}

export interface WipeDatabaseParams {
  currentPassword: string
  username: string
  password: string
  confirmText: string
}

/**
 * Wipe the database and create a fresh admin user
 */
export function useWipeDatabase() {
  return useMutation({
    mutationFn: async (params: WipeDatabaseParams) => {
      if (isDemoMode()) {
        toast.info('Database wipe is disabled in demo mode')
        throw new Error('Demo mode')
      }

      const res = await fetch('/api/admin/database/wipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to wipe database')
      }

      return res.json()
    },
    onSuccess: () => {
      toast.success('Database wiped successfully. Redirecting to login...')
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
    },
    onError: (err) => {
      if (err.message !== 'Demo mode') {
        toast.error(err.message)
      }
    },
  })
}
