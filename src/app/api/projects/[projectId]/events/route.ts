import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import {
  type LabelEvent,
  projectEvents,
  type RoleEvent,
  type SprintEvent,
  type TicketEvent,
} from '@/lib/events'

/**
 * GET /api/projects/[projectId]/events - Server-Sent Events endpoint
 * Streams real-time ticket updates to connected clients
 * Requires project membership
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    // Check connection limits
    if (!projectEvents.canUserConnect(user.id)) {
      return new Response(JSON.stringify({ error: 'Too many connections' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!projectEvents.canProjectAcceptConnection(projectId)) {
      return new Response(JSON.stringify({ error: 'Project connection limit reached' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Track connection and get cleanup function
    const cleanupConnection = projectEvents.trackConnection(user.id, projectId)

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`),
        )

        // Subscribe to project events (tickets, labels, roles, and sprints)
        const handleEvent = (event: TicketEvent | LabelEvent | RoleEvent | SprintEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            // Stream may be closed, ignore
          }
        }

        const unsubscribe = projectEvents.subscribeToProject(projectId, handleEvent)

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
          cleanupConnection()
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
      if (error.message.startsWith('Forbidden:')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    console.error('Failed to establish SSE connection:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Disable body parsing for SSE
export const dynamic = 'force-dynamic'
