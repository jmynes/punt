import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  createTicket,
  deleteTicket,
  listColumns,
  listLabels,
  listSprints,
  listTickets,
  listUsers,
  type TicketData,
  updateTicket,
} from '../api-client.js'
import { errorResponse, parseTicketKey, textResponse } from '../utils.js'

/**
 * Format a ticket for display
 * @param ticket - The ticket data
 * @param projectKey - Project key (optional, uses ticket.project.key if available)
 */
function formatTicket(ticket: TicketData, projectKey?: string): string {
  const lines: string[] = []
  const key = projectKey || ticket.project?.key || 'UNKNOWN'

  lines.push(`# ${key}-${ticket.number}: ${ticket.title}`)
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Type | ${ticket.type} |`)
  lines.push(`| Priority | ${ticket.priority} |`)
  lines.push(`| Status | ${ticket.column.name} |`)

  if (ticket.sprint) {
    lines.push(`| Sprint | ${ticket.sprint.name} (${ticket.sprint.status}) |`)
  }

  if (ticket.resolution) {
    lines.push(`| Resolution | ${ticket.resolution} |`)
  }

  if (ticket.storyPoints !== null) {
    lines.push(`| Story Points | ${ticket.storyPoints} |`)
  }

  if (ticket.assignee) {
    lines.push(`| Assignee | ${ticket.assignee.name} |`)
  }

  if (ticket.creator) {
    lines.push(`| Reporter | ${ticket.creator.name} |`)
  }

  if (ticket.labels.length > 0) {
    lines.push(`| Labels | ${ticket.labels.map((l) => l.name).join(', ')} |`)
  }

  if (ticket.estimate) {
    lines.push(`| Estimate | ${ticket.estimate} |`)
  }

  if (ticket.startDate) {
    lines.push(`| Start Date | ${new Date(ticket.startDate).toISOString().split('T')[0]} |`)
  }

  if (ticket.dueDate) {
    lines.push(`| Due Date | ${new Date(ticket.dueDate).toISOString().split('T')[0]} |`)
  }

  if (ticket.description) {
    lines.push('')
    lines.push('## Description')
    lines.push('')
    lines.push(ticket.description)
  }

  return lines.join('\n')
}

/**
 * Format a list of tickets for display
 * @param tickets - The tickets to format
 * @param projectKey - Project key (optional, uses ticket.project.key if available)
 */
function formatTicketList(tickets: TicketData[], projectKey?: string): string {
  if (tickets.length === 0) {
    return 'No tickets found.'
  }

  const lines: string[] = []
  lines.push('| Key | Title | Type | Priority | Status | Sprint | Assignee | Points |')
  lines.push('|-----|-------|------|----------|--------|--------|----------|--------|')

  for (const t of tickets) {
    const key = `${projectKey || t.project?.key || 'UNKNOWN'}-${t.number}`
    const title = t.title.length > 45 ? `${t.title.slice(0, 45)}...` : t.title
    const sprint = t.sprint?.name || '-'
    const assignee = t.assignee?.name || '-'
    const points = t.storyPoints ?? 1

    lines.push(
      `| ${key} | ${title} | ${t.type} | ${t.priority} | ${t.column.name} | ${sprint} | ${assignee} | ${points} |`,
    )
  }

  lines.push('')
  lines.push(`Total: ${tickets.length} ticket(s)`)

  return lines.join('\n')
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

      const result = await listTickets(parsed.projectKey)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = result.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      return textResponse(formatTicket(ticket, parsed.projectKey.toUpperCase()))
    },
  )

  // list_tickets - List tickets with filters
  server.tool(
    'list_tickets',
    'List tickets with optional filters',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
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
      const result = await listTickets(projectKey)
      if (result.error) {
        return errorResponse(result.error)
      }

      let tickets = result.data || []

      // Apply filters
      if (column) {
        tickets = tickets.filter((t) => t.column.name.toLowerCase().includes(column.toLowerCase()))
      }
      if (priority) {
        tickets = tickets.filter((t) => t.priority === priority)
      }
      if (type) {
        tickets = tickets.filter((t) => t.type === type)
      }
      if (assignee) {
        tickets = tickets.filter((t) =>
          t.assignee?.name.toLowerCase().includes(assignee.toLowerCase()),
        )
      }
      if (sprint) {
        tickets = tickets.filter((t) => t.sprint?.name.toLowerCase().includes(sprint.toLowerCase()))
      }

      // Apply limit
      tickets = tickets.slice(0, limit)

      return textResponse(formatTicketList(tickets, projectKey.toUpperCase()))
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
      reporter: z.string().optional().describe('Reporter name (defaults to authenticated user)'),
      storyPoints: z.number().min(0).optional().describe('Story points'),
      estimate: z.string().optional().describe('Time estimate (e.g., "2h", "1d")'),
      startDate: z.string().optional().describe('Start date (ISO format: YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('Due date (ISO format: YYYY-MM-DD)'),
      labels: z.array(z.string()).optional().describe('Label names to assign'),
      sprint: z.string().optional().describe('Sprint name to assign to'),
      resolution: z
        .enum(['Done', "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Incomplete', "Won't Do"])
        .nullable()
        .optional()
        .describe('Resolution (e.g., "Done", "Won\'t Fix", "Duplicate")'),
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
      reporter,
      storyPoints,
      estimate,
      startDate,
      dueDate,
      labels,
      sprint,
      resolution,
      environment,
      affectedVersion,
      fixVersion,
    }) => {
      // Get columns to find columnId
      const columnsResult = await listColumns(projectKey)
      if (columnsResult.error) {
        return errorResponse(columnsResult.error)
      }

      const columns = columnsResult.data || []
      if (columns.length === 0) {
        return errorResponse('No columns found in project')
      }

      // Find column by name or use first
      let columnId: string
      if (column) {
        const col = columns.find((c) => c.name.toLowerCase().includes(column.toLowerCase()))
        if (!col) {
          return errorResponse(`Column not found: ${column}`)
        }
        columnId = col.id
      } else {
        columnId = columns[0].id
      }

      // Get assignee ID if specified
      let assigneeId: string | undefined
      if (assignee) {
        const usersResult = await listUsers()
        if (usersResult.error) {
          return errorResponse(usersResult.error)
        }
        const user = usersResult.data?.find((u) =>
          u.name.toLowerCase().includes(assignee.toLowerCase()),
        )
        if (!user) {
          return errorResponse(`User not found: ${assignee}`)
        }
        assigneeId = user.id
      }

      // Get reporter ID if specified
      let reporterId: string | undefined
      if (reporter) {
        const usersResult = await listUsers()
        if (usersResult.error) {
          return errorResponse(usersResult.error)
        }
        const user = usersResult.data?.find((u) =>
          u.name.toLowerCase().includes(reporter.toLowerCase()),
        )
        if (!user) {
          return errorResponse(`User not found: ${reporter}`)
        }
        reporterId = user.id
      }

      // Get sprint ID if specified
      let sprintId: string | undefined
      if (sprint) {
        const sprintsResult = await listSprints(projectKey)
        if (sprintsResult.error) {
          return errorResponse(sprintsResult.error)
        }
        const sp = sprintsResult.data?.find((s) =>
          s.name.toLowerCase().includes(sprint.toLowerCase()),
        )
        if (!sp) {
          return errorResponse(`Sprint not found: ${sprint}`)
        }
        sprintId = sp.id
      }

      // Get label IDs if specified
      let labelIds: string[] | undefined
      if (labels && labels.length > 0) {
        const labelsResult = await listLabels(projectKey)
        if (labelsResult.error) {
          return errorResponse(labelsResult.error)
        }
        labelIds = []
        for (const labelName of labels) {
          const label = labelsResult.data?.find(
            (l) => l.name.toLowerCase() === labelName.toLowerCase(),
          )
          if (!label) {
            return errorResponse(`Label not found: ${labelName}`)
          }
          labelIds.push(label.id)
        }
      }

      const result = await createTicket(projectKey, {
        title,
        description: description || null,
        type,
        priority,
        columnId,
        assigneeId: assigneeId || null,
        reporterId: reporterId || null,
        sprintId: sprintId || null,
        storyPoints: storyPoints || null,
        estimate: estimate || null,
        resolution: resolution || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        environment: environment || null,
        affectedVersion: affectedVersion || null,
        fixVersion: fixVersion || null,
        labelIds,
      })

      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = result.data!
      const upperKey = projectKey.toUpperCase()
      return textResponse(
        `Created ticket ${upperKey}-${ticket.number}\n\n${formatTicket(ticket, upperKey)}`,
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
      estimate: z.string().nullable().optional().describe('Time estimate'),
      startDate: z.string().nullable().optional().describe('Start date (null to clear)'),
      dueDate: z.string().nullable().optional().describe('Due date (null to clear)'),
      labels: z.array(z.string()).optional().describe('Label names (replaces existing)'),
      column: z.string().optional().describe('Move to column'),
      sprint: z.string().nullable().optional().describe('Sprint name (null for backlog)'),
      resolution: z
        .enum(['Done', "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Incomplete', "Won't Do"])
        .nullable()
        .optional()
        .describe('Resolution'),
      environment: z.string().nullable().optional().describe('Environment'),
      affectedVersion: z.string().nullable().optional().describe('Affected version'),
      fixVersion: z.string().nullable().optional().describe('Fix version'),
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
      column,
      sprint,
      resolution,
      environment,
      affectedVersion,
      fixVersion,
    }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const existingTicket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!existingTicket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      // Build update data
      const updateData: Record<string, unknown> = {}

      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (priority !== undefined) updateData.priority = priority
      if (type !== undefined) updateData.type = type
      if (storyPoints !== undefined) updateData.storyPoints = storyPoints
      if (estimate !== undefined) updateData.estimate = estimate
      if (startDate !== undefined) updateData.startDate = startDate
      if (dueDate !== undefined) updateData.dueDate = dueDate
      if (resolution !== undefined) updateData.resolution = resolution
      if (environment !== undefined) updateData.environment = environment
      if (affectedVersion !== undefined) updateData.affectedVersion = affectedVersion
      if (fixVersion !== undefined) updateData.fixVersion = fixVersion

      // Handle column
      if (column !== undefined) {
        const columnsResult = await listColumns(parsed.projectKey)
        if (columnsResult.error) {
          return errorResponse(columnsResult.error)
        }
        const col = columnsResult.data?.find((c) =>
          c.name.toLowerCase().includes(column.toLowerCase()),
        )
        if (!col) {
          return errorResponse(`Column not found: ${column}`)
        }
        updateData.columnId = col.id
      }

      // Handle assignee
      if (assignee !== undefined) {
        if (assignee === null) {
          updateData.assigneeId = null
        } else {
          const usersResult = await listUsers()
          if (usersResult.error) {
            return errorResponse(usersResult.error)
          }
          const user = usersResult.data?.find((u) =>
            u.name.toLowerCase().includes(assignee.toLowerCase()),
          )
          if (!user) {
            return errorResponse(`User not found: ${assignee}`)
          }
          updateData.assigneeId = user.id
        }
      }

      // Handle sprint
      if (sprint !== undefined) {
        if (sprint === null) {
          updateData.sprintId = null
        } else {
          const sprintsResult = await listSprints(parsed.projectKey)
          if (sprintsResult.error) {
            return errorResponse(sprintsResult.error)
          }
          const sp = sprintsResult.data?.find((s) =>
            s.name.toLowerCase().includes(sprint.toLowerCase()),
          )
          if (!sp) {
            return errorResponse(`Sprint not found: ${sprint}`)
          }
          updateData.sprintId = sp.id
        }
      }

      // Handle labels
      if (labels !== undefined) {
        const labelsResult = await listLabels(parsed.projectKey)
        if (labelsResult.error) {
          return errorResponse(labelsResult.error)
        }
        const labelIds: string[] = []
        for (const labelName of labels) {
          const label = labelsResult.data?.find(
            (l) => l.name.toLowerCase() === labelName.toLowerCase(),
          )
          if (!label) {
            return errorResponse(`Label not found: ${labelName}`)
          }
          labelIds.push(label.id)
        }
        updateData.labelIds = labelIds
      }

      const result = await updateTicket(parsed.projectKey, existingTicket.id, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = result.data!
      return textResponse(
        `Updated ticket ${key}\n\n${formatTicket(ticket, parsed.projectKey.toUpperCase())}`,
      )
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

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const existingTicket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!existingTicket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const updateData: Record<string, unknown> = {}
      const changes: string[] = []

      // Handle column move
      if (column) {
        const columnsResult = await listColumns(parsed.projectKey)
        if (columnsResult.error) {
          return errorResponse(columnsResult.error)
        }
        const col = columnsResult.data?.find((c) =>
          c.name.toLowerCase().includes(column.toLowerCase()),
        )
        if (!col) {
          return errorResponse(`Column not found: ${column}`)
        }
        updateData.columnId = col.id
        changes.push(`column → ${col.name}`)
      }

      // Handle sprint move
      if (sprint !== undefined) {
        if (sprint === null) {
          updateData.sprintId = null
          changes.push('sprint → backlog')
        } else {
          const sprintsResult = await listSprints(parsed.projectKey)
          if (sprintsResult.error) {
            return errorResponse(sprintsResult.error)
          }
          const sp = sprintsResult.data?.find((s) =>
            s.name.toLowerCase().includes(sprint.toLowerCase()),
          )
          if (!sp) {
            return errorResponse(`Sprint not found: ${sprint}`)
          }
          updateData.sprintId = sp.id
          changes.push(`sprint → ${sp.name}`)
        }
      }

      if (Object.keys(updateData).length === 0) {
        return errorResponse('No changes specified. Provide column or sprint.')
      }

      const result = await updateTicket(parsed.projectKey, existingTicket.id, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = result.data!
      return textResponse(
        `Moved ${key}: ${changes.join(', ')}\n\n${formatTicket(ticket, parsed.projectKey.toUpperCase())}`,
      )
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

      // Get the ticket to find its ID and title
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const existingTicket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!existingTicket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await deleteTicket(parsed.projectKey, existingTicket.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(`Deleted ${key}: ${existingTicket.title}`)
    },
  )
}
