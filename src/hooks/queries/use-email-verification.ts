'use client'

import { useQuery } from '@tanstack/react-query'

export interface EmailVerificationStatus {
  email: string | null
  emailVerified: boolean
  emailVerificationEnabled: boolean
}

export const emailVerificationKeys = {
  status: ['email-verification-status'] as const,
}

/**
 * Fetch current user's email verification status
 */
export function useEmailVerificationStatus() {
  return useQuery<EmailVerificationStatus>({
    queryKey: emailVerificationKeys.status,
    queryFn: async () => {
      const res = await fetch('/api/me/verification-status')
      if (!res.ok) {
        throw new Error('Failed to fetch verification status')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
