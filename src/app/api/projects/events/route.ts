import { requireAuth } from '@/lib/auth-helpers'
import { type ProjectEvent, projectEvents } from '@/lib/events'

/**
 * GET /api/projects/events - Server-Sent Events endpoint for project list changes
 * Streams real-time project create/update/delete events to connected clients
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
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`),
        )

        // Subscribe to global project events
        const handleEvent = (event: ProjectEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            // Stream may be closed, ignore
          }
        }

        const unsubscribe = projectEvents.subscribeToProjects(handleEvent)

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
          unsubscribe()
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
    console.error('Failed to establish SSE connection for projects:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Disable body parsing for SSE
export const dynamic = 'force-dynamic'
