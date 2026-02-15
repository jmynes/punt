import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { parseCommitMessage, type TicketAction } from '@/lib/git-hooks'
import { isCompletedColumn } from '@/lib/sprint-utils'

/**
 * Git Hook Integration API
 *
 * This endpoint processes git commit information and updates tickets based on
 * commit message patterns. Authentication is via API key (same as MCP).
 *
 * Supported actions:
 * - "close": Move ticket to Done column and set resolution
 * - "reference": Add commit info to ticket (future: comments)
 * - "in_progress": Move ticket to In Progress column
 */

const commitSchema = z.object({
  message: z.string().min(1),
  sha: z.string().optional(),
  author: z.string().optional(),
  timestamp: z.string().optional(),
  branch: z.string().optional(),
})

const gitHookSchema = z.object({
  commits: z.array(commitSchema).min(1),
  // Optional: specify which projects to process (default: all referenced)
  projectKeys: z.array(z.string()).optional(),
  // Dry run mode: parse and return what would happen without making changes
  dryRun: z.boolean().optional().default(false),
})

interface TicketUpdate {
  ticketKey: string
  action: TicketAction
  success: boolean
  message: string
  ticketId?: string
}

/**
 * Authenticate via API key (same as MCP).
 * Returns the user if authenticated, null otherwise.
 */
async function authenticateApiKey() {
  const headersList = await headers()
  const apiKey = headersList.get('X-API-Key') || headersList.get('X-MCP-API-Key')

  if (!apiKey) {
    return null
  }

  const user = await db.user.findUnique({
    where: { mcpApiKey: apiKey },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  })

  if (user?.isActive) {
    return user
  }

  return null
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

  // Look for common "in progress" column names
  const inProgressPatterns = ['in progress', 'in-progress', 'doing', 'working', 'active']
  return columns.find((col) => inProgressPatterns.includes(col.name.toLowerCase()))
}

/**
 * Process a single ticket action.
 */
async function processTicketAction(
  ticketKey: string,
  action: TicketAction,
  userId: string,
  commit: { sha?: string; author?: string; branch?: string },
  dryRun: boolean,
): Promise<TicketUpdate> {
  // Parse ticket key
  const [projectKey, ticketNumberStr] = ticketKey.split('-')
  const ticketNumber = parseInt(ticketNumberStr, 10)

  if (!projectKey || Number.isNaN(ticketNumber)) {
    return {
      ticketKey,
      action,
      success: false,
      message: 'Invalid ticket key format',
    }
  }

  // Find the project
  const project = await db.project.findUnique({
    where: { key: projectKey.toUpperCase() },
    select: { id: true },
  })

  if (!project) {
    return {
      ticketKey,
      action,
      success: false,
      message: `Project ${projectKey} not found`,
    }
  }

  // Check if user is a member of the project
  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: project.id } },
  })

  // Also check if user is a system admin
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  })

  if (!membership && !user?.isSystemAdmin) {
    return {
      ticketKey,
      action,
      success: false,
      message: `Not a member of project ${projectKey}`,
    }
  }

  // Find the ticket
  const ticket = await db.ticket.findUnique({
    where: { projectId_number: { projectId: project.id, number: ticketNumber } },
    select: {
      id: true,
      columnId: true,
      column: { select: { name: true } },
      resolution: true,
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

  if (dryRun) {
    return {
      ticketKey,
      action,
      success: true,
      message: `Would ${action} ticket`,
      ticketId: ticket.id,
    }
  }

  // Process based on action
  switch (action) {
    case 'close': {
      // Move to Done column and set resolution
      const doneColumn = await findDoneColumn(project.id)
      if (!doneColumn) {
        return {
          ticketKey,
          action,
          success: false,
          message: 'No Done column found in project',
          ticketId: ticket.id,
        }
      }

      // Only update if not already done
      if (!isCompletedColumn(ticket.column.name)) {
        await db.ticket.update({
          where: { id: ticket.id },
          data: {
            columnId: doneColumn.id,
            resolution: 'Done',
            resolvedAt: new Date(),
          },
        })

        // Emit SSE event
        projectEvents.emitTicketEvent({
          type: 'ticket.moved',
          projectId: project.id,
          ticketId: ticket.id,
          userId,
          timestamp: Date.now(),
        })
      }

      return {
        ticketKey,
        action,
        success: true,
        message: `Ticket moved to Done${commit.sha ? ` (commit: ${commit.sha.substring(0, 7)})` : ''}`,
        ticketId: ticket.id,
      }
    }

    case 'in_progress': {
      // Move to In Progress column
      const inProgressColumn = await findInProgressColumn(project.id)
      if (!inProgressColumn) {
        return {
          ticketKey,
          action,
          success: false,
          message: 'No In Progress column found in project',
          ticketId: ticket.id,
        }
      }

      // Only update if not already in progress or done
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
            // Clear resolution if moving back to in progress
            resolution: null,
            resolvedAt: null,
          },
        })

        // Emit SSE event
        projectEvents.emitTicketEvent({
          type: 'ticket.moved',
          projectId: project.id,
          ticketId: ticket.id,
          userId,
          timestamp: Date.now(),
        })
      }

      return {
        ticketKey,
        action,
        success: true,
        message: `Ticket marked as in progress${commit.sha ? ` (commit: ${commit.sha.substring(0, 7)})` : ''}`,
        ticketId: ticket.id,
      }
    }

    case 'reference': {
      // For now, just acknowledge the reference
      // Future: Add comment with commit info
      return {
        ticketKey,
        action,
        success: true,
        message: `Ticket referenced${commit.sha ? ` in commit ${commit.sha.substring(0, 7)}` : ''}`,
        ticketId: ticket.id,
      }
    }

    default:
      return {
        ticketKey,
        action,
        success: false,
        message: `Unknown action: ${action}`,
        ticketId: ticket.id,
      }
  }
}

/**
 * POST /api/integrations/git-hook - Process git commits and update tickets
 *
 * Requires API key authentication (X-API-Key or X-MCP-API-Key header).
 */
export async function POST(request: Request) {
  try {
    // Authenticate
    const user = await authenticateApiKey()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide X-API-Key header.' },
        { status: 401 },
      )
    }

    // Parse request body
    const body = await request.json()
    const parsed = gitHookSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { commits, projectKeys, dryRun } = parsed.data

    // Parse all commits and extract ticket references
    const allUpdates: TicketUpdate[] = []

    for (const commit of commits) {
      const parsedCommit = parseCommitMessage(commit.message)

      for (const ticket of parsedCommit.tickets) {
        // Filter by project keys if specified
        if (projectKeys && !projectKeys.includes(ticket.projectKey)) {
          continue
        }

        // Skip if already processed (use most significant action)
        // Priority: close > in_progress > reference
        const existingUpdate = allUpdates.find((u) => u.ticketKey === ticket.ticketKey)
        if (existingUpdate) {
          const actionPriority = { close: 3, in_progress: 2, reference: 1 }
          if (actionPriority[ticket.action] <= actionPriority[existingUpdate.action]) {
            continue
          }
          // Remove the existing update to replace with higher priority
          const idx = allUpdates.findIndex((u) => u.ticketKey === ticket.ticketKey)
          if (idx >= 0) {
            allUpdates.splice(idx, 1)
          }
        }

        // Process the ticket action
        const update = await processTicketAction(
          ticket.ticketKey,
          ticket.action,
          user.id,
          commit,
          dryRun ?? false,
        )

        allUpdates.push(update)
      }
    }

    // Prepare response
    const response = {
      success: true,
      dryRun: dryRun ?? false,
      processed: allUpdates.length,
      updates: allUpdates,
      summary: {
        closed: allUpdates.filter((u) => u.action === 'close' && u.success).length,
        inProgress: allUpdates.filter((u) => u.action === 'in_progress' && u.success).length,
        referenced: allUpdates.filter((u) => u.action === 'reference' && u.success).length,
        failed: allUpdates.filter((u) => !u.success).length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error, 'process git hook')
  }
}

/**
 * GET /api/integrations/git-hook - Get hook installation instructions
 */
export async function GET() {
  return NextResponse.json({
    description: 'Git Hook Integration API for PUNT',
    version: '1.0.0',
    endpoints: {
      POST: {
        description: 'Process git commits and update tickets based on commit messages',
        authentication: 'API key via X-API-Key or X-MCP-API-Key header',
        body: {
          commits: [
            {
              message: 'Commit message (required)',
              sha: 'Commit SHA (optional)',
              author: 'Author name (optional)',
              timestamp: 'ISO timestamp (optional)',
              branch: 'Branch name (optional)',
            },
          ],
          projectKeys: 'Array of project keys to filter (optional)',
          dryRun: 'If true, only parse and report what would happen (optional)',
        },
      },
    },
    patterns: {
      close: [
        'fix PUNT-123',
        'fixes PUNT-123',
        'close PUNT-123',
        'closes PUNT-123',
        'resolve PUNT-123',
        'resolves PUNT-123',
      ],
      in_progress: ['wip PUNT-123', 'working on PUNT-123', 'started PUNT-123'],
      reference: ['PUNT-123 (standalone mention)', 'ref PUNT-123', 'refs PUNT-123', 'see PUNT-123'],
    },
    installation: {
      instructions: 'See /scripts/git-hooks/README.md for installation instructions',
      quickStart: [
        '1. Generate an API key in PUNT: Profile > API Key',
        '2. Copy scripts/git-hooks/post-commit to your repo .git/hooks/',
        '3. Set PUNT_API_KEY environment variable',
        '4. Set PUNT_BASE_URL if not using localhost:3000',
      ],
    },
  })
}
