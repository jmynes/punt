'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

// Tabs that have moved to /account
const ACCOUNT_TAB_REDIRECTS: Record<string, string> = {
  profile: '/account/avatar',
  security: '/account/security',
  'claude-chat': '/account/chat',
  mcp: '/account/mcp',
}

// Preferences tabs now use route-based URLs
const PREFERENCE_TAB_REDIRECTS: Record<string, string> = {
  general: '/preferences/general',
  appearance: '/preferences/appearance',
  notifications: '/preferences/notifications',
}

export default function PreferencesPage() {
  return (
    <Suspense>
      <PreferencesRedirect />
    </Suspense>
  )
}

function PreferencesRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  useEffect(() => {
    if (tabParam && tabParam in ACCOUNT_TAB_REDIRECTS) {
      router.replace(ACCOUNT_TAB_REDIRECTS[tabParam])
      return
    }

    if (tabParam && tabParam in PREFERENCE_TAB_REDIRECTS) {
      router.replace(PREFERENCE_TAB_REDIRECTS[tabParam])
      return
    }

    // Default: redirect to appearance (alphabetically first)
    router.replace('/preferences/appearance')
  }, [tabParam, router])

  return null
}
