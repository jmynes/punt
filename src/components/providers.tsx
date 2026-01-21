'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useSession } from 'next-auth/react'
import { type ReactNode, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'

/**
 * Component that enables real-time user profile synchronization.
 * Only connects to SSE when user is authenticated.
 */
function RealtimeUsersProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  // Only enable SSE when authenticated
  useRealtimeUsers(status === 'authenticated')
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
