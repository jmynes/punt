'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SystemSettings } from '@/lib/system-settings'

export const systemSettingsKeys = {
  all: ['system-settings'] as const,
}

/**
 * Fetch system settings
 */
export function useSystemSettings() {
  return useQuery<SystemSettings>({
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
  maxImageSizeMB?: number
  maxVideoSizeMB?: number
  maxDocumentSizeMB?: number
  maxAttachmentsPerTicket?: number
  allowedImageTypes?: string[]
  allowedVideoTypes?: string[]
  allowedDocumentTypes?: string[]
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
      return res.json() as Promise<SystemSettings>
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: systemSettingsKeys.all })

      const previousSettings = queryClient.getQueryData<SystemSettings>(systemSettingsKeys.all)

      // Optimistic update
      if (previousSettings) {
        queryClient.setQueryData<SystemSettings>(systemSettingsKeys.all, {
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
    },
  })
}
