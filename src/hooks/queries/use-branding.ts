'use client'

import { useQuery } from '@tanstack/react-query'
import { DEFAULT_BRANDING } from '@/lib/branding'
import type { BrandingSettings } from '@/lib/data-provider'
import { getDataProvider } from '@/lib/data-provider'

export const brandingKeys = {
  all: ['branding'] as const,
}

/**
 * Fetch public branding settings (no auth required)
 * Used by header and login page
 * In demo mode, returns default branding via data provider
 */
export function useBranding() {
  return useQuery<BrandingSettings>({
    queryKey: brandingKeys.all,
    queryFn: async () => {
      const provider = getDataProvider()
      return provider.getBranding()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Return defaults while loading
    placeholderData: { ...DEFAULT_BRANDING },
  })
}
