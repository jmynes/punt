'use client'

import { KeyRound, Plug, User } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/common'
import { IntegrationsTab } from '@/components/profile/integrations-tab'
import { ProfileTab } from '@/components/profile/profile-tab'
import { SecurityTab } from '@/components/profile/security-tab'
import { DEMO_USER, isDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'

// Stable user data type
interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
}

type ProfileTabType = 'profile' | 'security' | 'integrations'

const VALID_TABS: ProfileTabType[] = ['profile', 'security', 'integrations']

function isValidTab(tab: string | null): tab is ProfileTabType {
  return tab !== null && VALID_TABS.includes(tab as ProfileTabType)
}

export default function ProfilePage() {
  const isDemo = isDemoMode()
  const searchParams = useSearchParams()

  // Tab management
  const tabParam = searchParams.get('tab')
  const activeTab: ProfileTabType = isValidTab(tabParam) ? tabParam : 'profile'

  // In demo mode, we skip useSession entirely
  const {
    data: session,
    status,
    update: updateSession,
  } = isDemo
    ? { data: null, status: 'authenticated' as const, update: async () => null }
    : // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
      useSession()

  // Store stable user data that persists during session refresh
  const [stableUser, setStableUser] = useState<UserData | null>(
    isDemo
      ? {
          id: DEMO_USER.id,
          name: DEMO_USER.name,
          email: DEMO_USER.email,
          avatar: DEMO_USER.avatar,
          avatarColor: null,
          isSystemAdmin: DEMO_USER.isSystemAdmin,
        }
      : null,
  )

  // Track if we're in the middle of a session update to prevent flashing
  const isUpdatingRef = useRef(false)

  // Update stable user when session changes (but not during our own updates)
  useEffect(() => {
    if (isDemo) return // Skip in demo mode - already initialized
    if (session?.user?.id && !isUpdatingRef.current) {
      setStableUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.avatar,
        avatarColor: session.user.avatarColor,
        isSystemAdmin: session.user.isSystemAdmin,
      })
    }
  }, [
    isDemo,
    session?.user?.id,
    session?.user?.name,
    session?.user?.email,
    session?.user?.avatar,
    session?.user?.avatarColor,
    session?.user?.isSystemAdmin,
  ])

  // Debounced session update to prevent race conditions
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedUpdateSession = useCallback(async () => {
    if (isDemo) return

    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current)
    }

    return new Promise<void>((resolve) => {
      pendingUpdateRef.current = setTimeout(async () => {
        isUpdatingRef.current = true
        try {
          await updateSession()
        } finally {
          setTimeout(() => {
            isUpdatingRef.current = false
          }, 100)
          resolve()
        }
      }, 50)
    })
  }, [isDemo, updateSession])

  // Handler to update user state
  const handleUserUpdate = useCallback((updates: Partial<UserData>) => {
    setStableUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  // Show loading only during initial session load, not during updates
  if (!isDemo && status === 'loading' && !stableUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (!isDemo && status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500">Please sign in to view your profile.</div>
      </div>
    )
  }

  if (!stableUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-zinc-500">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        variant="hero"
        icon={User}
        category="Profile"
        title="Account Settings"
        description="Manage your profile, security, and integrations"
      />

      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-3xl px-6 overflow-auto">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <Link
            href="/profile?tab=profile"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'profile'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <Link
            href="/profile?tab=security"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'security'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <KeyRound className="h-4 w-4" />
            Security
          </Link>
          <Link
            href="/profile?tab=integrations"
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'integrations'
                ? 'text-amber-500 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300',
            )}
          >
            <Plug className="h-4 w-4" />
            Integrations
          </Link>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 pb-8">
          {activeTab === 'profile' && (
            <ProfileTab
              user={stableUser}
              isDemo={isDemo}
              onUserUpdate={handleUserUpdate}
              onSessionUpdate={debouncedUpdateSession}
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab
              user={stableUser}
              isDemo={isDemo}
              onUserUpdate={handleUserUpdate}
              onSessionUpdate={debouncedUpdateSession}
            />
          )}
          {activeTab === 'integrations' && <IntegrationsTab isDemo={isDemo} />}
        </div>
      </div>
    </div>
  )
}
