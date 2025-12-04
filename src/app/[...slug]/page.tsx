'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'

export default function CatchAllPage() {
  const pathname = usePathname()
  const router = useRouter()
  const shownToasts = useRef<Set<string>>(new Set())

  useLayoutEffect(() => {
    // Don't show toast if we're already on the home page (shouldn't happen, but safety check)
    if (pathname === '/') return

    // Only redirect once per unique invalid route
    if (shownToasts.current.has(pathname)) return

    shownToasts.current.add(pathname)

    // Store invalid path in sessionStorage for the home page to read
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('punt:invalidPath', pathname)
    }

    // Clean redirect without query params
    router.replace('/')
  }, [pathname, router])

  return null
}

