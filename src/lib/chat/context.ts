/**
 * Context building utilities for Claude Chat
 * Builds system prompts with relevant project/ticket context
 */

import { db } from '@/lib/db'

interface ChatContext {
  projectId?: string
  ticketKey?: string
}

interface ProjectContext {
  key: string
  name: string
  description: string | null
  columns: string[]
  labels: string[]
  activeSprint: string | null
  memberCount: number
  ticketCount: number
}

interface TicketContext {
  key: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  assignee: string | null
  sprint: string | null
  storyPoints: number | null
  labels: string[]
}

/**
 * Build system prompt with context about the current project/ticket
 */
export async function buildSystemPrompt(context: ChatContext): Promise<string> {
  const parts: string[] = []

  // Base system prompt
  parts.push(`You are a helpful assistant integrated into PUNT, a project management and issue tracking system.
You can help users manage their tickets, sprints, and projects through natural conversation.

When users ask you to do something, use the available tools to accomplish it. Be concise but helpful.

Key capabilities:
- List, create, and update tickets
- View project details and sprints
- Search for tickets by various criteria
- Help with sprint planning and ticket organization`)

  // Add project context if available
  if (context.projectId) {
    const projectCtx = await getProjectContext(context.projectId)
    if (projectCtx) {
      parts.push('')
      parts.push('## Current Project Context')
      parts.push(`You are viewing project **${projectCtx.key}** (${projectCtx.name}).`)
      if (projectCtx.description) {
        parts.push(`Description: ${projectCtx.description}`)
      }
      parts.push(`Columns: ${projectCtx.columns.join(', ')}`)
      if (projectCtx.labels.length > 0) {
        parts.push(`Labels: ${projectCtx.labels.join(', ')}`)
      }
      if (projectCtx.activeSprint) {
        parts.push(`Active sprint: ${projectCtx.activeSprint}`)
      }
      parts.push(`${projectCtx.ticketCount} tickets, ${projectCtx.memberCount} members`)
    }
  }

  // Add ticket context if available
  if (context.ticketKey) {
    const ticketCtx = await getTicketContext(context.ticketKey)
    if (ticketCtx) {
      parts.push('')
      parts.push('## Current Ticket Context')
      parts.push(`User is viewing ticket **${ticketCtx.key}**: ${ticketCtx.title}`)
      parts.push(
        `Type: ${ticketCtx.type}, Priority: ${ticketCtx.priority}, Status: ${ticketCtx.status}`,
      )
      if (ticketCtx.assignee) parts.push(`Assignee: ${ticketCtx.assignee}`)
      if (ticketCtx.sprint) parts.push(`Sprint: ${ticketCtx.sprint}`)
      if (ticketCtx.storyPoints !== null) parts.push(`Story points: ${ticketCtx.storyPoints}`)
      if (ticketCtx.labels.length > 0) parts.push(`Labels: ${ticketCtx.labels.join(', ')}`)
      if (ticketCtx.description) {
        parts.push(
          `Description: ${ticketCtx.description.slice(0, 500)}${ticketCtx.description.length > 500 ? '...' : ''}`,
        )
      }
    }
  }

  return parts.join('\n')
}

async function getProjectContext(projectId: string): Promise<ProjectContext | null> {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          select: { name: true },
        },
        labels: {
          select: { name: true },
        },
        sprints: {
          where: { status: 'active' },
          select: { name: true },
          take: 1,
        },
        _count: {
          select: {
            tickets: true,
            members: true,
          },
        },
      },
    })

    if (!project) return null

    return {
      key: project.key,
      name: project.name,
      description: project.description,
      columns: project.columns.map((c) => c.name),
      labels: project.labels.map((l) => l.name),
      activeSprint: project.sprints[0]?.name ?? null,
      memberCount: project._count.members,
      ticketCount: project._count.tickets,
    }
  } catch {
    return null
  }
}

async function getTicketContext(ticketKey: string): Promise<TicketContext | null> {
  try {
    // Parse ticket key (e.g., "PUNT-123")
    const match = ticketKey.match(/^([A-Z]+)-(\d+)$/i)
    if (!match) return null

    const [, projectKey, numberStr] = match
    const number = parseInt(numberStr, 10)

    const ticket = await db.ticket.findFirst({
      where: {
        number,
        project: {
          key: projectKey.toUpperCase(),
        },
      },
      include: {
        project: { select: { key: true } },
        column: { select: { name: true } },
        assignee: { select: { name: true } },
        sprint: { select: { name: true } },
        labels: { select: { name: true } },
      },
    })

    if (!ticket) return null

    return {
      key: `${ticket.project.key}-${ticket.number}`,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      priority: ticket.priority,
      status: ticket.column.name,
      assignee: ticket.assignee?.name ?? null,
      sprint: ticket.sprint?.name ?? null,
      storyPoints: ticket.storyPoints,
      labels: ticket.labels.map((l) => l.name),
    }
  } catch {
    return null
  }
}
