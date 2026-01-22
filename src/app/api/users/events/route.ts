import { requireAuth } from '@/lib/auth-helpers'
import { type BrandingEvent, projectEvents, type UserEvent } from '@/lib/events'

/**
 * GET /api/users/events - Server-Sent Events endpoint for user profile changes
 * Streams real-time user profile update events to connected clients
 * Requires authentication (any authenticated user can listen)
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', listenerId: user.id })}\n\n`),
        )

        // Subscribe to global user events
        const handleUserEvent = (event: UserEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            // Stream may be closed, ignore
          }
        }

        // Subscribe to global branding events
        const handleBrandingEvent = (event: BrandingEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            // Stream may be closed, ignore
          }
        }

        const unsubscribeUsers = projectEvents.subscribeToUsers(handleUserEvent)
        const unsubscribeBranding = projectEvents.subscribeToBranding(handleBrandingEvent)

        // Send keepalive comment every 30 seconds to prevent timeout
        const keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`))
          } catch {
            // Stream may be closed, ignore
          }
        }, 30000)

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          unsubscribeUsers()
          unsubscribeBranding()
          clearInterval(keepaliveInterval)
          try {
            controller.close()
          } catch {
            // Already closed
          }
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    console.error('Failed to establish SSE connection for users:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Disable body parsing for SSE
export const dynamic = 'force-dynamic'
