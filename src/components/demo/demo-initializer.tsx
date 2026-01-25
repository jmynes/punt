'use client'

import { useEffect, useState } from 'react'
import { demoStorage, isDemoMode } from '@/lib/demo'

interface DemoInitializerProps {
  children: React.ReactNode
}

/**
 * Initializes demo storage on first load
 * Seeds localStorage with demo data if not already present
 */
export function DemoInitializer({ children }: DemoInitializerProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isDemoMode()) {
      // Initialize demo storage with seed data
      demoStorage.initialize()
    }
    setReady(true)
  }, [])

  // Show nothing while initializing to prevent flash of content
  // This is very fast since it's just localStorage
  if (!ready && isDemoMode()) {
    return null
  }

  return <>{children}</>
}
