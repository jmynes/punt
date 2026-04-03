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
  const isDemo = isDemoMode()
  const { data: session, update: updateSession } = useSession()

  const [user, setUser] = useState<UserData | null>(
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

  const isUpdatingRef = useRef(false)

  useEffect(() => {
    if (isDemo) return
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
    isDemo,
    session?.user?.id,
    session?.user?.name,
    session?.user?.email,
    session?.user?.avatar,
    session?.user?.avatarColor,
    session?.user?.isSystemAdmin,
  ])

  // Debounced session update
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSessionUpdate = useCallback(async () => {
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

  const handleUserUpdate = useCallback((updates: Partial<UserData>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  return { user, isDemo, handleUserUpdate, onSessionUpdate }
}
