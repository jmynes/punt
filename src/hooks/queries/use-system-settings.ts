'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { EmailProviderType, EmailSettings } from '@/lib/email/types'
import type { SystemSettings } from '@/lib/system-settings'
import { brandingKeys } from './use-branding'

// Combined settings type that includes both upload and email settings
export type CombinedSystemSettings = SystemSettings & EmailSettings

export const systemSettingsKeys = {
  all: ['system-settings'] as const,
}

/**
 * Fetch system settings (combined upload + email settings)
 */
export function useSystemSettings() {
  return useQuery<CombinedSystemSettings>({
    queryKey: systemSettingsKeys.all,
    queryFn: async () => {
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
}

/**
 * Update system settings
 */
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateSystemSettingsParams) => {
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
      toast.error(err.message)
    },
    onSuccess: () => {
      toast.success('Settings updated')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
      // Also invalidate public branding cache
      queryClient.invalidateQueries({ queryKey: brandingKeys.all })
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
      toast.success('Logo uploaded')
    },
    onError: (err) => {
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
      queryClient.invalidateQueries({ queryKey: brandingKeys.all })
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
      const res = await fetch('/api/admin/settings/logo', {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete logo')
      }
      return res.json()
    },
    onSuccess: () => {
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
      toast.success('Logo removed')
    },
    onError: (err) => {
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all })
      queryClient.invalidateQueries({ queryKey: brandingKeys.all })
    },
  })
}

/**
 * Send a test email to verify email configuration
 */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
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
    onSuccess: () => {
      toast.success('Test email sent successfully')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}
