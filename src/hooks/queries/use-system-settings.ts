'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isDemoMode } from '@/lib/demo'
import type { EmailProviderType, EmailSettings } from '@/lib/email/types'
import type { RepoHostingProvider, SystemSettings } from '@/lib/system-settings'
import { showToast } from '@/lib/toast'
import { brandingKeys } from './use-branding'

// Combined settings type that includes both upload and email settings
export type CombinedSystemSettings = SystemSettings & EmailSettings

export const systemSettingsKeys = {
  all: ['system-settings'] as const,
}

// Demo mode default settings
const DEMO_SYSTEM_SETTINGS: CombinedSystemSettings = {
  // Required SystemSettings fields
  id: 'demo-settings',
  updatedAt: new Date(),
  updatedBy: null,
  // Upload settings
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
  // Branding settings
  appName: 'PUNT',
  logoLetter: 'P',
  logoGradientFrom: '#f59e0b',
  logoGradientTo: '#d97706',
  logoUrl: null,
  // Board settings
  showAddColumnButton: true,
  // Email settings
  emailEnabled: false,
  emailProvider: 'none',
  emailFromAddress: '',
  emailFromName: 'PUNT',
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpSecure: true,
  emailPasswordReset: true,
  emailWelcome: false,
  emailVerification: false,
  emailInvitations: true,
  // Repository configuration
  canonicalRepoUrl: 'https://github.com/jmynes/punt/',
  repoHostingProvider: 'github',
  forkRepoUrl: null,
  // Agent configuration defaults
  defaultBranchTemplate: '{type}/{key}-{slug}',
  defaultAgentGuidance: null,
}

/**
 * Fetch system settings (combined upload + email settings)
 */
export function useSystemSettings() {
  return useQuery<CombinedSystemSettings>({
    queryKey: systemSettingsKeys.all,
    queryFn: async () => {
      // Demo mode: return demo settings
      if (isDemoMode()) {
        return DEMO_SYSTEM_SETTINGS
      }

      const res = await fetch('/api/admin/settings')
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch system settings')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export interface UpdateSystemSettingsParams {
  // Branding settings
  appName?: string
  logoLetter?: string
  logoGradientFrom?: string
  logoGradientTo?: string

  // Upload settings
  maxImageSizeMB?: number
  maxVideoSizeMB?: number
  maxDocumentSizeMB?: number
  maxAttachmentsPerTicket?: number
  allowedImageTypes?: string[]
  allowedVideoTypes?: string[]
  allowedDocumentTypes?: string[]

  // Board settings
  showAddColumnButton?: boolean

  // Email settings
  emailEnabled?: boolean
  emailProvider?: EmailProviderType
  emailFromAddress?: string
  emailFromName?: string
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpSecure?: boolean
  emailPasswordReset?: boolean
  emailWelcome?: boolean
  emailVerification?: boolean
  emailInvitations?: boolean

  // Repository configuration
  canonicalRepoUrl?: string | null
  repoHostingProvider?: RepoHostingProvider | null
  forkRepoUrl?: string | null
}

/**
 * Update system settings
 */
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateSystemSettingsParams) => {
      // Demo mode: show info toast and return current settings
      if (isDemoMode()) {
        showToast.info('Settings are read-only in demo mode')
        return { ...DEMO_SYSTEM_SETTINGS, ...data }
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update settings')
      }
      return res.json() as Promise<CombinedSystemSettings>
    },
    onMutate: async (data) => {
      if (isDemoMode()) return {}

      await queryClient.cancelQueries({ queryKey: systemSettingsKeys.all })

      const previousSettings = queryClient.getQueryData<CombinedSystemSettings>(
        systemSettingsKeys.all,
      )

      // Optimistic update
      if (previousSettings) {
        queryClient.setQueryData<CombinedSystemSettings>(systemSettingsKeys.all, {
          ...previousSettings,
          ...data,
        })
      }

      return { previousSettings }
    },
    onError: (err, _, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(systemSettingsKeys.all, context.previousSettings)
      }
      showToast.error(err.message)
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        showToast.success('Settings updated')
      }
    },
    onSettled: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
        // Also invalidate public branding cache
        queryClient.invalidateQueries({ queryKey: brandingKeys.all })
      }
    },
  })
}

/**
 * Upload a custom logo
 */
export function useUploadLogo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      // Demo mode: show info toast
      if (isDemoMode()) {
        showToast.info('Logo upload is disabled in demo mode')
        return { success: false, logoUrl: '' }
      }

      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/admin/settings/logo', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upload logo')
      }
      return res.json() as Promise<{ success: boolean; logoUrl: string }>
    },
    onSuccess: (data) => {
      if (isDemoMode() || !data.success) return

      // Update the settings cache with new logo URL
      const currentSettings = queryClient.getQueryData<CombinedSystemSettings>(
        systemSettingsKeys.all,
      )
      if (currentSettings) {
        queryClient.setQueryData<CombinedSystemSettings>(systemSettingsKeys.all, {
          ...currentSettings,
          logoUrl: data.logoUrl,
        })
      }
      showToast.success('Logo uploaded')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
    onSettled: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
        queryClient.invalidateQueries({ queryKey: brandingKeys.all })
      }
    },
  })
}

/**
 * Delete the custom logo
 */
export function useDeleteLogo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Demo mode: show info toast
      if (isDemoMode()) {
        showToast.info('Logo deletion is disabled in demo mode')
        return { success: false }
      }

      const res = await fetch('/api/admin/settings/logo', {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete logo')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (isDemoMode() || !data.success) return

      // Update the settings cache to clear logo URL
      const currentSettings = queryClient.getQueryData<CombinedSystemSettings>(
        systemSettingsKeys.all,
      )
      if (currentSettings) {
        queryClient.setQueryData<CombinedSystemSettings>(systemSettingsKeys.all, {
          ...currentSettings,
          logoUrl: null,
        })
      }
      showToast.success('Logo removed')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
    onSettled: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
        queryClient.invalidateQueries({ queryKey: brandingKeys.all })
      }
    },
  })
}

/**
 * Send a test email to verify email configuration
 */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      // Demo mode: show info toast
      if (isDemoMode()) {
        showToast.info('Test email is disabled in demo mode')
        return { success: false }
      }

      const res = await fetch('/api/admin/settings/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send test email')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (!isDemoMode() && data.success !== false) {
        showToast.success('Test email sent successfully')
      }
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}
