'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_USER, isDemoMode } from '@/lib/demo'

export interface UserData {
  id: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
}

export function useAccountUser() {
  if (isDemoMode()) {
    // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant; SessionProvider is not mounted in demo mode
    return useDemoAccountUser()
  }

  const isDemo = false
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant; SessionProvider is not mounted in demo mode
  const { data: session, update: updateSession } = useSession()

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  const [user, setUser] = useState<UserData | null>(null)

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  const isUpdatingRef = useRef(false)

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  useEffect(() => {
    if (session?.user?.id && !isUpdatingRef.current) {
      setUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.avatar,
        avatarColor: session.user.avatarColor,
        isSystemAdmin: session.user.isSystemAdmin,
      })
    }
  }, [
    session?.user?.id,
    session?.user?.name,
    session?.user?.email,
    session?.user?.avatar,
    session?.user?.avatarColor,
    session?.user?.isSystemAdmin,
  ])

  // Debounced session update
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  const onSessionUpdate = useCallback(async () => {
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
  }, [updateSession])

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is a build-time constant
  const handleUserUpdate = useCallback((updates: Partial<UserData>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  return { user, isDemo, handleUserUpdate, onSessionUpdate }
}

function useDemoAccountUser() {
  const [user, setUser] = useState<UserData | null>({
    id: DEMO_USER.id,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    avatar: DEMO_USER.avatar,
    avatarColor: null,
    isSystemAdmin: DEMO_USER.isSystemAdmin,
  })

  const handleUserUpdate = useCallback((updates: Partial<UserData>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  const onSessionUpdate = useCallback(async () => {}, [])

  return { user, isDemo: true, handleUserUpdate, onSessionUpdate }
}
