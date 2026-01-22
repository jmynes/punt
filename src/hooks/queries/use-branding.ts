'use client'

import { useQuery } from '@tanstack/react-query'
import type { BrandingSettings } from '@/lib/system-settings'
import { DEFAULT_BRANDING } from '@/lib/system-settings'

export const brandingKeys = {
  all: ['branding'] as const,
}

/**
 * Fetch public branding settings (no auth required)
 * Used by header and login page
 */
export function useBranding() {
  return useQuery<BrandingSettings>({
    queryKey: brandingKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/branding')
      if (!res.ok) {
        // Return defaults on error
        return { ...DEFAULT_BRANDING }
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Return defaults while loading
    placeholderData: { ...DEFAULT_BRANDING },
  })
}
