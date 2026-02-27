import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import {
  type CommitPattern,
  parseCommitMessageWithPatterns,
  type TicketAction,
} from '@/lib/git-hooks'
import { isCompletedColumn } from '@/lib/sprint-utils'

/**
 * GitHub Webhook Integration
 *
 * Receives push events from GitHub and updates tickets based on commit messages.
 * Users configure a webhook in their GitHub repo settings pointing to:
 *   https://your-punt-instance.com/api/webhooks/github
 *
 * Setup:
 * 1. In PUNT: Go to Project Settings > Repository and set a webhook secret
 * 2. In GitHub: Go to repo Settings > Webhooks > Add webhook
 *    - Payload URL: https://your-punt-instance.com/api/webhooks/github
 *    - Content type: application/json
 *    - Secret: (same secret you set in PUNT)
 *    - Events: Just the push event
 */

// GitHub push event commit schema
const commitSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string().optional(),
  author: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
})

// GitHub push event payload schema (partial - only what we need)
const pushEventSchema = z.object({
  ref: z.string(), // e.g., "refs/heads/main"
  repository: z.object({
    full_name: z.string(), // e.g., "owner/repo"
    html_url: z.string(), // e.g., "https://github.com/owner/repo"
    clone_url: z.string().optional(), // e.g., "https://github.com/owner/repo.git"
  }),
  commits: z.array(commitSchema).default([]),
  head_commit: commitSchema.nullable().optional(),
  pusher: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
})

interface TicketUpdate {
  ticketKey: string
  action: TicketAction
  success: boolean
  message: string
}

/**
 * Verify GitHub webhook signature using HMAC SHA-256.
 * Returns true if signature is valid, false otherwise.
 */
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) {
    return false
  }

  // GitHub sends signature as "sha256=<hex>"
  const [algorithm, hash] = signature.split('=')
  if (algorithm !== 'sha256' || !hash) {
    return false
  }

  const expectedHash = createHmac('sha256', secret).update(payload).digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'))
  } catch {
    return false
  }
}

/**
 * Find a project by its repository URL.
 * Matches against repositoryUrl field, handling URL variations.
 */
async function findProjectByRepoUrl(repoUrl: string, repoFullName: string) {
  // Normalize URLs for comparison
  const normalizedUrls = [
    repoUrl,
    repoUrl.replace(/\.git$/, ''),
    `https://github.com/${repoFullName}`,
    `https://github.com/${repoFullName}.git`,
  ]

  const project = await db.project.findFirst({
    where: {
      OR: normalizedUrls.map((url) => ({ repositoryUrl: url })),
    },
    select: {
      id: true,
      key: true,
      webhookSecret: true,
      commitPatterns: true,
    },
  })

  return project
}

/**
 * Find the "Done" column for a project.
 */
async function findDoneColumn(projectId: string) {
  const columns = await db.column.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })

  return columns.find((col) => isCompletedColumn(col.name))
}

/**
 * Find the "In Progress" column for a project.
 */
async function findInProgressColumn(projectId: string) {
  const columns = await db.column.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })

  const inProgressPatterns = ['in progress', 'in-progress', 'doing', 'working', 'active']
  return columns.find((col) => inProgressPatterns.includes(col.name.toLowerCase()))
}

/**
 * Process a ticket action from a commit.
 */
async function processTicketAction(
  ticketKey: string,
  action: TicketAction,
  projectId: string,
  projectKey: string,
  commit: { id: string; author?: { name?: string } },
): Promise<TicketUpdate> {
  // Parse ticket key
  const [ticketProjectKey, ticketNumberStr] = ticketKey.split('-')
  const ticketNumber = parseInt(ticketNumberStr, 10)

  if (!ticketProjectKey || Number.isNaN(ticketNumber)) {
    return {
      ticketKey,
      action,
      success: false,
      message: 'Invalid ticket key format',
    }
  }

  // Only process tickets for this project
  if (ticketProjectKey.toUpperCase() !== projectKey.toUpperCase()) {
    return {
      ticketKey,
      action,
      success: false,
      message: `Ticket belongs to different project (${ticketProjectKey})`,
    }
  }

  // Find the ticket
  const ticket = await db.ticket.findUnique({
    where: { projectId_number: { projectId, number: ticketNumber } },
    select: {
      id: true,
      columnId: true,
      column: { select: { name: true } },
    },
  })

  if (!ticket) {
    return {
      ticketKey,
      action,
      success: false,
      message: `Ticket ${ticketKey} not found`,
    }
  }

  // Process based on action
  switch (action) {
    case 'close': {
      const doneColumn = await findDoneColumn(projectId)
      if (!doneColumn) {
        return {
          ticketKey,
          action,
          success: false,
          message: 'No Done column found',
        }
      }

      if (!isCompletedColumn(ticket.column.name)) {
        await db.ticket.update({
          where: { id: ticket.id },
          data: {
            columnId: doneColumn.id,
            resolution: 'Done',
            resolvedAt: new Date(),
          },
        })

        projectEvents.emitTicketEvent({
          type: 'ticket.moved',
          projectId,
          ticketId: ticket.id,
          timestamp: Date.now(),
        })
      }

      return {
        ticketKey,
        action,
        success: true,
        message: `Closed by commit ${commit.id.substring(0, 7)}`,
      }
    }

    case 'in_progress': {
      const inProgressColumn = await findInProgressColumn(projectId)
      if (!inProgressColumn) {
        return {
          ticketKey,
          action,
          success: false,
          message: 'No In Progress column found',
        }
      }

      const currentColName = ticket.column.name.toLowerCase()
      const isAlreadyInProgress =
        currentColName === 'in progress' ||
        currentColName === 'in-progress' ||
        currentColName === 'doing'

      if (!isAlreadyInProgress && !isCompletedColumn(ticket.column.name)) {
        await db.ticket.update({
          where: { id: ticket.id },
          data: {
            columnId: inProgressColumn.id,
            resolution: null,
            resolvedAt: null,
          },
        })

        projectEvents.emitTicketEvent({
          type: 'ticket.moved',
          projectId,
          ticketId: ticket.id,
          timestamp: Date.now(),
        })
      }

      return {
        ticketKey,
        action,
        success: true,
        message: `Marked in progress by commit ${commit.id.substring(0, 7)}`,
      }
    }

    case 'reference': {
      return {
        ticketKey,
        action,
        success: true,
        message: `Referenced in commit ${commit.id.substring(0, 7)}`,
      }
    }

    default:
      return {
        ticketKey,
        action,
        success: false,
        message: `Unknown action: ${action}`,
      }
  }
}

/**
 * POST /api/webhooks/github - Handle GitHub push events
 */
export async function POST(request: Request) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()

    // Get GitHub headers
    const signature = request.headers.get('X-Hub-Signature-256')
    const event = request.headers.get('X-GitHub-Event')
    const delivery = request.headers.get('X-GitHub-Delivery')

    // Only handle push events
    if (event !== 'push') {
      return NextResponse.json({
        success: true,
        message: `Ignored event type: ${event}`,
        delivery,
      })
    }

    // Parse the payload
    let payload: z.infer<typeof pushEventSchema>
    try {
      const parsed = pushEventSchema.safeParse(JSON.parse(rawBody))
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid payload format', details: parsed.error.issues },
          { status: 400 },
        )
      }
      payload = parsed.data
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Find the project by repository URL
    const project = await findProjectByRepoUrl(
      payload.repository.html_url,
      payload.repository.full_name,
    )

    if (!project) {
      return NextResponse.json(
        {
          error: 'No project found for this repository',
          repository: payload.repository.full_name,
          hint: 'Configure the repository URL in Project Settings > Repository',
        },
        { status: 404 },
      )
    }

    // Verify webhook signature if secret is configured
    if (project.webhookSecret) {
      if (!verifySignature(rawBody, signature, project.webhookSecret)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }
    } else if (signature) {
      // Signature provided but no secret configured - warn but continue
      console.warn(
        `[Webhook] Project ${project.key} received signed webhook but has no secret configured`,
      )
    }

    // Get commits to process
    const commits = payload.commits.length > 0 ? payload.commits : []

    // Include head_commit if not in commits array (happens for some events)
    if (payload.head_commit && !commits.some((c) => c.id === payload.head_commit?.id)) {
      commits.push(payload.head_commit)
    }

    if (commits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No commits to process',
        delivery,
      })
    }

    // Native JSON field - already parsed by Prisma
    const customPatterns: CommitPattern[] | null =
      (project.commitPatterns as CommitPattern[] | null) ?? null

    // Process all commits
    const allUpdates: TicketUpdate[] = []
    const seenTickets = new Set<string>()

    for (const commit of commits) {
      const parsed = parseCommitMessageWithPatterns(commit.message, customPatterns)

      for (const ticket of parsed.tickets) {
        // Skip duplicates (use most significant action)
        const key = ticket.ticketKey
        if (seenTickets.has(key)) {
          continue
        }

        // Only process tickets for this project
        if (ticket.projectKey.toUpperCase() !== project.key.toUpperCase()) {
          continue
        }

        seenTickets.add(key)

        const update = await processTicketAction(
          ticket.ticketKey,
          ticket.action,
          project.id,
          project.key,
          commit,
        )

        allUpdates.push(update)
      }
    }

    // Extract branch name from ref
    const branch = payload.ref.replace('refs/heads/', '')

    return NextResponse.json({
      success: true,
      delivery,
      repository: payload.repository.full_name,
      branch,
      project: project.key,
      commits: commits.length,
      processed: allUpdates.length,
      updates: allUpdates,
      summary: {
        closed: allUpdates.filter((u) => u.action === 'close' && u.success).length,
        inProgress: allUpdates.filter((u) => u.action === 'in_progress' && u.success).length,
        referenced: allUpdates.filter((u) => u.action === 'reference' && u.success).length,
        failed: allUpdates.filter((u) => !u.success).length,
      },
    })
  } catch (error) {
    return handleApiError(error, 'process GitHub webhook')
  }
}

/**
 * GET /api/webhooks/github - Webhook setup instructions
 */
export async function GET() {
  return NextResponse.json({
    description: 'GitHub Webhook Integration for PUNT',
    version: '1.0.0',
    setup: {
      steps: [
        '1. In PUNT: Go to Project Settings > Repository',
        '2. Set your Repository URL (e.g., https://github.com/owner/repo)',
        '3. Generate or set a Webhook Secret',
        '4. In GitHub: Go to repo Settings > Webhooks > Add webhook',
        '5. Set Payload URL to: https://your-punt-instance.com/api/webhooks/github',
        '6. Set Content type to: application/json',
        '7. Set Secret to: (the same secret from step 3)',
        '8. Select events: Just the push event',
        '9. Save the webhook',
      ],
    },
    patterns: {
      close: ['fix PROJ-123', 'fixes PROJ-123', 'close PROJ-123', 'closes PROJ-123'],
      in_progress: ['wip PROJ-123', 'working on PROJ-123'],
      reference: ['PROJ-123 (standalone mention)', 'ref PROJ-123'],
    },
  })
}
