import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import {
  errorResponse,
  formatTicket,
  formatTicketList,
  parseTicketKey,
  textResponse,
} from '../utils.js'

// Prisma select patterns
const USER_SELECT = { id: true, name: true, email: true, avatar: true }
const LABEL_SELECT = { id: true, name: true, color: true }
const SPRINT_SELECT = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  goal: true,
}

const TICKET_SELECT = {
  id: true,
  number: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  order: true,
  storyPoints: true,
  estimate: true,
  startDate: true,
  dueDate: true,
  environment: true,
  affectedVersion: true,
  fixVersion: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  columnId: true,
  assignee: { select: USER_SELECT },
  creator: { select: USER_SELECT },
  column: { select: { id: true, name: true, order: true } },
  sprint: { select: SPRINT_SELECT },
  labels: { select: LABEL_SELECT },
  project: { select: { id: true, key: true, name: true } },
}

export function registerTicketTools(server: McpServer) {
  // get_ticket - Get a ticket by key
  server.tool(
    'get_ticket',
    'Get a ticket by key (e.g., PUNT-2)',
    {
      key: z.string().describe('Ticket key like PUNT-2'),
    },
    async ({ key }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}. Expected format: PROJECT-123`)
      }

      const project = await db.project.findUnique({
        where: { key: parsed.projectKey },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${parsed.projectKey}`)
      }

      const ticket = await db.ticket.findFirst({
        where: {
          projectId: project.id,
          number: parsed.number,
        },
        select: TICKET_SELECT,
      })

      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      return textResponse(formatTicket(ticket))
    },
  )

  // list_tickets - List tickets with filters
  server.tool(
    'list_tickets',
    'List tickets with optional filters',
    {
      projectKey: z.string().optional().describe('Filter by project key (e.g., PUNT)'),
      column: z.string().optional().describe('Filter by column name (e.g., "In Progress")'),
      priority: z
        .enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical'])
        .optional()
        .describe('Filter by priority'),
      type: z
        .enum(['epic', 'story', 'task', 'bug', 'subtask'])
        .optional()
        .describe('Filter by type'),
      assignee: z.string().optional().describe('Filter by assignee name'),
      sprint: z.string().optional().describe('Filter by sprint name'),
      limit: z.number().min(1).max(100).default(20).describe('Max results to return'),
    },
    async ({ projectKey, column, priority, type, assignee, sprint, limit }) => {
      // Build where clause
      const where: Record<string, unknown> = {}

      if (projectKey) {
        const project = await db.project.findUnique({
          where: { key: projectKey.toUpperCase() },
          select: { id: true },
        })
        if (!project) {
          return errorResponse(`Project not found: ${projectKey}`)
        }
        where.projectId = project.id
      }

      if (column) {
        where.column = { name: { contains: column } }
      }

      if (priority) {
        where.priority = priority
      }

      if (type) {
        where.type = type
      }

      if (assignee) {
        where.assignee = { name: { contains: assignee } }
      }

      if (sprint) {
        where.sprint = { name: { contains: sprint } }
      }

      const tickets = await db.ticket.findMany({
        where,
        select: TICKET_SELECT,
        orderBy: [{ project: { key: 'asc' } }, { number: 'desc' }],
        take: limit,
      })

      return textResponse(formatTicketList(tickets))
    },
  )

  // create_ticket - Create a new ticket
  server.tool(
    'create_ticket',
    'Create a new ticket in a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      title: z.string().min(1).describe('Ticket title'),
      type: z
        .enum(['epic', 'story', 'task', 'bug', 'subtask'])
        .default('task')
        .describe('Ticket type'),
      priority: z
        .enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical'])
        .default('medium')
        .describe('Ticket priority'),
      description: z.string().optional().describe('Ticket description'),
      column: z.string().optional().describe('Column name (defaults to first column)'),
      assignee: z.string().optional().describe('Assignee name'),
      storyPoints: z.number().min(0).optional().describe('Story points'),
      estimate: z.string().optional().describe('Time estimate (e.g., "2h", "1d")'),
      startDate: z.string().optional().describe('Start date (ISO format: YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('Due date (ISO format: YYYY-MM-DD)'),
      labels: z.array(z.string()).optional().describe('Label names to assign'),
      sprint: z.string().optional().describe('Sprint name to assign to'),
      parent: z.string().optional().describe('Parent ticket key for subtasks'),
      environment: z.string().optional().describe('Environment (e.g., "Production")'),
      affectedVersion: z.string().optional().describe('Affected version'),
      fixVersion: z.string().optional().describe('Fix version'),
    },
    async ({
      projectKey,
      title,
      type,
      priority,
      description,
      column,
      assignee,
      storyPoints,
      estimate,
      startDate,
      dueDate,
      labels,
      sprint,
      parent,
      environment,
      affectedVersion,
      fixVersion,
    }) => {
      // Find project
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          columns: { orderBy: { order: 'asc' }, take: 1, select: { id: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Get column
      let columnId: string
      if (column) {
        const col = await db.column.findFirst({
          where: {
            projectId: project.id,
            name: { contains: column },
          },
          select: { id: true },
        })
        if (!col) {
          return errorResponse(`Column not found: ${column}`)
        }
        columnId = col.id
      } else if (project.columns[0]) {
        columnId = project.columns[0].id
      } else {
        return errorResponse('No columns found in project')
      }

      // Get assignee if specified
      let assigneeId: string | null = null
      if (assignee) {
        const user = await db.user.findFirst({
          where: { name: { contains: assignee } },
          select: { id: true },
        })
        if (!user) {
          return errorResponse(`User not found: ${assignee}`)
        }
        assigneeId = user.id
      }

      // Get sprint if specified
      let sprintId: string | null = null
      if (sprint) {
        const sp = await db.sprint.findFirst({
          where: { projectId: project.id, name: { contains: sprint } },
          select: { id: true },
        })
        if (!sp) {
          return errorResponse(`Sprint not found: ${sprint}`)
        }
        sprintId = sp.id
      }

      // Get parent ticket if specified
      let parentId: string | null = null
      if (parent) {
        const parsed = parseTicketKey(parent)
        if (!parsed) {
          return errorResponse(`Invalid parent ticket key: ${parent}`)
        }
        const parentTicket = await db.ticket.findFirst({
          where: { projectId: project.id, number: parsed.number },
          select: { id: true },
        })
        if (!parentTicket) {
          return errorResponse(`Parent ticket not found: ${parent}`)
        }
        parentId = parentTicket.id
      }

      // Get label IDs if specified
      let labelIds: string[] = []
      if (labels && labels.length > 0) {
        const foundLabels = await db.label.findMany({
          where: {
            projectId: project.id,
            name: { in: labels },
          },
          select: { id: true },
        })
        labelIds = foundLabels.map((l) => l.id)
        if (labelIds.length !== labels.length) {
          return errorResponse(`Some labels not found. Available labels in project needed.`)
        }
      }

      // Get next ticket number atomically
      const ticket = await db.$transaction(async (tx) => {
        const lastTicket = await tx.ticket.findFirst({
          where: { projectId: project.id },
          orderBy: { number: 'desc' },
          select: { number: true },
        })

        const nextNumber = (lastTicket?.number ?? 0) + 1

        // Get max order in column
        const lastInColumn = await tx.ticket.findFirst({
          where: { columnId },
          orderBy: { order: 'desc' },
          select: { order: true },
        })

        return tx.ticket.create({
          data: {
            number: nextNumber,
            title,
            description: description ?? null,
            type,
            priority,
            order: (lastInColumn?.order ?? -1) + 1,
            storyPoints: storyPoints ?? null,
            estimate: estimate ?? null,
            startDate: startDate ? new Date(startDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            environment: environment ?? null,
            affectedVersion: affectedVersion ?? null,
            fixVersion: fixVersion ?? null,
            projectId: project.id,
            columnId,
            assigneeId,
            sprintId,
            parentId,
            labels: labelIds.length > 0 ? { connect: labelIds.map((id) => ({ id })) } : undefined,
          },
          select: TICKET_SELECT,
        })
      })

      return textResponse(
        `Created ticket ${project.key}-${ticket.number}\n\n${formatTicket(ticket)}`,
      )
    },
  )

  // update_ticket - Update a ticket
  server.tool(
    'update_ticket',
    'Update an existing ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z
        .enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical'])
        .optional()
        .describe('New priority'),
      type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']).optional().describe('New type'),
      assignee: z.string().nullable().optional().describe('New assignee name (null to unassign)'),
      storyPoints: z.number().min(0).nullable().optional().describe('New story points'),
      estimate: z.string().nullable().optional().describe('Time estimate (e.g., "2h", "1d")'),
      startDate: z
        .string()
        .nullable()
        .optional()
        .describe('Start date (ISO: YYYY-MM-DD, null to clear)'),
      dueDate: z
        .string()
        .nullable()
        .optional()
        .describe('Due date (ISO: YYYY-MM-DD, null to clear)'),
      labels: z.array(z.string()).optional().describe('Label names (replaces existing)'),
      environment: z.string().nullable().optional().describe('Environment'),
      affectedVersion: z.string().nullable().optional().describe('Affected version'),
      fixVersion: z.string().nullable().optional().describe('Fix version'),
      parent: z.string().nullable().optional().describe('Parent ticket key (null to remove)'),
    },
    async ({
      key,
      title,
      description,
      priority,
      type,
      assignee,
      storyPoints,
      estimate,
      startDate,
      dueDate,
      labels,
      environment,
      affectedVersion,
      fixVersion,
      parent,
    }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      const project = await db.project.findUnique({
        where: { key: parsed.projectKey },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${parsed.projectKey}`)
      }

      const existingTicket = await db.ticket.findFirst({
        where: { projectId: project.id, number: parsed.number },
        select: { id: true, labels: { select: { id: true } } },
      })

      if (!existingTicket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      // Build update data
      const data: Record<string, unknown> = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (priority !== undefined) data.priority = priority
      if (type !== undefined) data.type = type
      if (storyPoints !== undefined) data.storyPoints = storyPoints
      if (estimate !== undefined) data.estimate = estimate
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
      if (environment !== undefined) data.environment = environment
      if (affectedVersion !== undefined) data.affectedVersion = affectedVersion
      if (fixVersion !== undefined) data.fixVersion = fixVersion

      // Handle assignee
      if (assignee !== undefined) {
        if (assignee === null) {
          data.assigneeId = null
        } else {
          const user = await db.user.findFirst({
            where: { name: { contains: assignee } },
            select: { id: true },
          })
          if (!user) {
            return errorResponse(`User not found: ${assignee}`)
          }
          data.assigneeId = user.id
        }
      }

      // Handle parent
      if (parent !== undefined) {
        if (parent === null) {
          data.parentId = null
        } else {
          const parentParsed = parseTicketKey(parent)
          if (!parentParsed) {
            return errorResponse(`Invalid parent ticket key: ${parent}`)
          }
          const parentTicket = await db.ticket.findFirst({
            where: { projectId: project.id, number: parentParsed.number },
            select: { id: true },
          })
          if (!parentTicket) {
            return errorResponse(`Parent ticket not found: ${parent}`)
          }
          data.parentId = parentTicket.id
        }
      }

      // Handle labels - replace all
      if (labels !== undefined) {
        const foundLabels = await db.label.findMany({
          where: { projectId: project.id, name: { in: labels } },
          select: { id: true },
        })
        data.labels = {
          disconnect: existingTicket.labels.map((l) => ({ id: l.id })),
          connect: foundLabels.map((l) => ({ id: l.id })),
        }
      }

      const ticket = await db.ticket.update({
        where: { id: existingTicket.id },
        data,
        select: TICKET_SELECT,
      })

      return textResponse(`Updated ticket ${key}\n\n${formatTicket(ticket)}`)
    },
  )

  // move_ticket - Move ticket to column/sprint
  server.tool(
    'move_ticket',
    'Move a ticket to a different column or sprint',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      column: z.string().optional().describe('Target column name'),
      sprint: z
        .string()
        .nullable()
        .optional()
        .describe('Target sprint name (null to remove from sprint)'),
    },
    async ({ key, column, sprint }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      const project = await db.project.findUnique({
        where: { key: parsed.projectKey },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${parsed.projectKey}`)
      }

      const existingTicket = await db.ticket.findFirst({
        where: { projectId: project.id, number: parsed.number },
        select: { id: true },
      })

      if (!existingTicket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const data: Record<string, unknown> = {}
      const changes: string[] = []

      // Handle column move
      if (column) {
        const col = await db.column.findFirst({
          where: {
            projectId: project.id,
            name: { contains: column },
          },
          select: { id: true, name: true },
        })
        if (!col) {
          return errorResponse(`Column not found: ${column}`)
        }

        // Get order at end of target column
        const lastInColumn = await db.ticket.findFirst({
          where: { columnId: col.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        })

        data.columnId = col.id
        data.order = (lastInColumn?.order ?? -1) + 1
        changes.push(`column → ${col.name}`)
      }

      // Handle sprint move
      if (sprint !== undefined) {
        if (sprint === null) {
          data.sprintId = null
          changes.push('sprint → backlog')
        } else {
          const sp = await db.sprint.findFirst({
            where: {
              projectId: project.id,
              name: { contains: sprint },
            },
            select: { id: true, name: true },
          })
          if (!sp) {
            return errorResponse(`Sprint not found: ${sprint}`)
          }
          data.sprintId = sp.id
          changes.push(`sprint → ${sp.name}`)
        }
      }

      if (Object.keys(data).length === 0) {
        return errorResponse('No changes specified. Provide column or sprint.')
      }

      const ticket = await db.ticket.update({
        where: { id: existingTicket.id },
        data,
        select: TICKET_SELECT,
      })

      return textResponse(`Moved ${key}: ${changes.join(', ')}\n\n${formatTicket(ticket)}`)
    },
  )

  // delete_ticket - Delete a ticket
  server.tool(
    'delete_ticket',
    'Delete a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
    },
    async ({ key }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      const project = await db.project.findUnique({
        where: { key: parsed.projectKey },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${parsed.projectKey}`)
      }

      const ticket = await db.ticket.findFirst({
        where: { projectId: project.id, number: parsed.number },
        select: { id: true, title: true },
      })

      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      // Delete related records first
      await db.ticketWatcher.deleteMany({ where: { ticketId: ticket.id } })
      await db.comment.deleteMany({ where: { ticketId: ticket.id } })
      await db.attachment.deleteMany({ where: { ticketId: ticket.id } })
      await db.ticketEdit.deleteMany({ where: { ticketId: ticket.id } })
      await db.ticketLink.deleteMany({
        where: { OR: [{ fromTicketId: ticket.id }, { toTicketId: ticket.id }] },
      })
      await db.ticketSprintHistory.deleteMany({ where: { ticketId: ticket.id } })

      await db.ticket.delete({ where: { id: ticket.id } })

      return textResponse(`Deleted ${key}: ${ticket.title}`)
    },
  )
}
