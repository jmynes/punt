'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useSession } from 'next-auth/react'
import { type ReactNode, useState } from 'react'
import { DemoInitializer } from '@/components/demo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { isDemoMode } from '@/lib/demo'

/**
 * Component that enables real-time user profile synchronization.
 * Only connects to SSE when user is authenticated.
 * Disabled in demo mode since there's no server.
 */
function RealtimeUsersProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  // Only enable SSE when authenticated and not in demo mode
  useRealtimeUsers(status === 'authenticated' && !isDemoMode())
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  // Demo mode: skip SessionProvider and RealtimeUsersProvider
  if (isDemoMode()) {
    return (
      <DemoInitializer>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </QueryClientProvider>
      </DemoInitializer>
    )
  }

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <RealtimeUsersProvider>{children}</RealtimeUsersProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
