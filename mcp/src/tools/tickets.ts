import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  type CommentData,
  createComment,
  createTicket,
  createTicketLink,
  deleteComment,
  deleteTicket,
  deleteTicketLink,
  listColumns,
  listComments,
  listLabels,
  listSprints,
  listTicketLinks,
  listTickets,
  searchTickets,
  type TicketData,
  type TicketLinkData,
  unwrapData,
  updateComment,
  updateTicket,
} from '../api-client.js'
import { resolveUser } from '../resolve-user.js'
import {
  errorResponse,
  escapeMarkdown,
  formatDate,
  formatTicket,
  formatTicketList,
  parseTicketKey,
  textResponse,
  truncate,
} from '../utils.js'

/**
 * Format a compact summary for a newly created ticket.
 * Shows only the key fields that were set.
 */
function formatTicketCreated(ticket: TicketData, projectKey: string): string {
  const key = `${projectKey}-${ticket.number}`
  const lines: string[] = []

  // Escape user-controlled title
  lines.push(`Created **${key}**: ${escapeMarkdown(ticket.title)}`)
  lines.push('')

  const fields: string[] = []
  fields.push(`**Type:** ${ticket.type}`)
  fields.push(`**Priority:** ${ticket.priority}`)
  // Escape user-controlled column name
  fields.push(`**Status:** ${escapeMarkdown(ticket.column.name)}`)
  if (ticket.assignee) fields.push(`**Assignee:** ${escapeMarkdown(ticket.assignee.name)}`)
  if (ticket.sprint) fields.push(`**Sprint:** ${escapeMarkdown(ticket.sprint.name)}`)
  if (ticket.storyPoints !== null) fields.push(`**Points:** ${ticket.storyPoints}`)
  if (ticket.labels.length > 0)
    fields.push(`**Labels:** ${ticket.labels.map((l) => escapeMarkdown(l.name)).join(', ')}`)
  if (ticket.estimate) fields.push(`**Estimate:** ${escapeMarkdown(ticket.estimate)}`)
  if (ticket.startDate) fields.push(`**Start:** ${formatDate(ticket.startDate)}`)
  if (ticket.dueDate) fields.push(`**Due:** ${formatDate(ticket.dueDate)}`)
  if (ticket.environment) fields.push(`**Environment:** ${escapeMarkdown(ticket.environment)}`)
  if (ticket.resolution) fields.push(`**Resolution:** ${escapeMarkdown(ticket.resolution)}`)
  if (ticket.parent) {
    const parentKey = `${projectKey}-${ticket.parent.number}`
    fields.push(`**Parent:** ${parentKey} (${escapeMarkdown(ticket.parent.title)})`)
  }

  lines.push(fields.join('  \n'))

  if (ticket.description) {
    lines.push('')
    // Escape and truncate user-controlled description
    lines.push(`**Description:** ${escapeMarkdown(truncate(ticket.description, 100))}`)
  }

  return lines.join('\n')
}

/**
 * Format a diff-style view of what changed on a ticket update.
 * Shows "field: old -> new" for each changed field.
 */
function formatTicketUpdated(key: string, oldTicket: TicketData, newTicket: TicketData): string {
  const lines: string[] = []
  lines.push(`Updated **${key}**`)
  lines.push('')

  const changes: string[] = []

  // Helper to escape a value or return 'none' for null/undefined
  const esc = (val: string | null | undefined, fallback = 'none'): string =>
    val ? escapeMarkdown(val) : fallback

  if (oldTicket.title !== newTicket.title) {
    changes.push(`**Title:** ${esc(oldTicket.title)} -> ${esc(newTicket.title)}`)
  }
  if (oldTicket.type !== newTicket.type) {
    changes.push(`**Type:** ${oldTicket.type} -> ${newTicket.type}`)
  }
  if (oldTicket.priority !== newTicket.priority) {
    changes.push(`**Priority:** ${oldTicket.priority} -> ${newTicket.priority}`)
  }
  if (oldTicket.column.name !== newTicket.column.name) {
    changes.push(`**Status:** ${esc(oldTicket.column.name)} -> ${esc(newTicket.column.name)}`)
  }
  if ((oldTicket.resolution ?? null) !== (newTicket.resolution ?? null)) {
    changes.push(`**Resolution:** ${esc(oldTicket.resolution)} -> ${esc(newTicket.resolution)}`)
  }
  if ((oldTicket.assignee?.name ?? null) !== (newTicket.assignee?.name ?? null)) {
    changes.push(
      `**Assignee:** ${esc(oldTicket.assignee?.name, 'unassigned')} -> ${esc(newTicket.assignee?.name, 'unassigned')}`,
    )
  }
  if ((oldTicket.sprint?.name ?? null) !== (newTicket.sprint?.name ?? null)) {
    changes.push(
      `**Sprint:** ${esc(oldTicket.sprint?.name, 'backlog')} -> ${esc(newTicket.sprint?.name, 'backlog')}`,
    )
  }
  if (oldTicket.storyPoints !== newTicket.storyPoints) {
    changes.push(
      `**Points:** ${oldTicket.storyPoints ?? 'none'} -> ${newTicket.storyPoints ?? 'none'}`,
    )
  }
  if ((oldTicket.estimate ?? null) !== (newTicket.estimate ?? null)) {
    changes.push(`**Estimate:** ${esc(oldTicket.estimate)} -> ${esc(newTicket.estimate)}`)
  }
  if ((oldTicket.startDate ?? null) !== (newTicket.startDate ?? null)) {
    changes.push(
      `**Start:** ${oldTicket.startDate ? formatDate(oldTicket.startDate) : 'none'} -> ${newTicket.startDate ? formatDate(newTicket.startDate) : 'none'}`,
    )
  }
  if ((oldTicket.dueDate ?? null) !== (newTicket.dueDate ?? null)) {
    changes.push(
      `**Due:** ${oldTicket.dueDate ? formatDate(oldTicket.dueDate) : 'none'} -> ${newTicket.dueDate ? formatDate(newTicket.dueDate) : 'none'}`,
    )
  }
  if ((oldTicket.environment ?? null) !== (newTicket.environment ?? null)) {
    changes.push(`**Environment:** ${esc(oldTicket.environment)} -> ${esc(newTicket.environment)}`)
  }
  if ((oldTicket.affectedVersion ?? null) !== (newTicket.affectedVersion ?? null)) {
    changes.push(
      `**Affected Version:** ${esc(oldTicket.affectedVersion)} -> ${esc(newTicket.affectedVersion)}`,
    )
  }
  if ((oldTicket.fixVersion ?? null) !== (newTicket.fixVersion ?? null)) {
    changes.push(`**Fix Version:** ${esc(oldTicket.fixVersion)} -> ${esc(newTicket.fixVersion)}`)
  }

  // Parent comparison
  const oldParentKey = oldTicket.parent ? `${key.split('-')[0]}-${oldTicket.parent.number}` : null
  const newParentKey = newTicket.parent ? `${key.split('-')[0]}-${newTicket.parent.number}` : null
  if (oldParentKey !== newParentKey) {
    changes.push(`**Parent:** ${oldParentKey ?? 'none'} -> ${newParentKey ?? 'none'}`)
  }

  // Labels comparison (escape each label name)
  const oldLabels = oldTicket.labels
    .map((l) => escapeMarkdown(l.name))
    .sort()
    .join(', ')
  const newLabels = newTicket.labels
    .map((l) => escapeMarkdown(l.name))
    .sort()
    .join(', ')
  if (oldLabels !== newLabels) {
    changes.push(`**Labels:** ${oldLabels || 'none'} -> ${newLabels || 'none'}`)
  }

  // Description change (just note it changed, don't show full diff)
  if ((oldTicket.description ?? null) !== (newTicket.description ?? null)) {
    if (!newTicket.description) {
      changes.push('**Description:** cleared')
    } else if (!oldTicket.description) {
      changes.push('**Description:** added')
    } else {
      changes.push('**Description:** updated')
    }
  }

  if (changes.length === 0) {
    lines.push('No changes detected.')
  } else {
    for (const change of changes) {
      lines.push(`- ${change}`)
    }
  }

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

      return textResponse(
        formatTicket({
          ...ticket,
          project: ticket.project ?? { key: parsed.projectKey.toUpperCase(), name: '' },
        }),
      )
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
      label: z.string().optional().describe('Filter by label name (tickets with this label)'),
      resolution: z
        .string()
        .optional()
        .describe(
          'Filter by resolution: "resolved" (any resolution set), "unresolved" (no resolution), or a specific resolution value',
        ),
      missingFields: z
        .array(
          z.enum([
            'storyPoints',
            'assignee',
            'sprint',
            'labels',
            'description',
            'estimate',
            'dueDate',
            'startDate',
            'parent',
          ]),
        )
        .optional()
        .describe('Find tickets missing these fields (e.g., ["storyPoints", "assignee"])'),
      parent: z
        .string()
        .optional()
        .describe('Parent ticket key (e.g., "PUNT-5") to filter subtasks'),
      hasAttachments: z
        .boolean()
        .optional()
        .describe(
          'Filter by attachment presence: true for tickets with attachments, false for tickets without',
        ),
      search: z
        .string()
        .optional()
        .describe('Text search across title and description (case-insensitive)'),
      limit: z.number().min(1).max(100).default(20).describe('Max results to return'),
    },
    async ({
      projectKey,
      column,
      priority,
      type,
      assignee,
      sprint,
      label,
      resolution,
      missingFields,
      parent,
      hasAttachments,
      search,
      limit,
    }) => {
      // Pass hasAttachments to API for server-side filtering when possible
      const result = await listTickets(projectKey, { hasAttachments })
      if (result.error) {
        return errorResponse(result.error)
      }

      let tickets = result.data || []

      // Apply filters
      const appliedFilters: string[] = []
      // hasAttachments is filtered server-side, but track it for the filter note
      if (hasAttachments !== undefined) {
        appliedFilters.push(`hasAttachments: ${hasAttachments}`)
      }
      if (column) {
        tickets = tickets.filter((t) => t.column.name.toLowerCase().includes(column.toLowerCase()))
        appliedFilters.push(`column: ${column}`)
      }
      if (priority) {
        tickets = tickets.filter((t) => t.priority === priority)
        appliedFilters.push(`priority: ${priority}`)
      }
      if (type) {
        tickets = tickets.filter((t) => t.type === type)
        appliedFilters.push(`type: ${type}`)
      }
      if (assignee) {
        tickets = tickets.filter((t) =>
          t.assignee?.name.toLowerCase().includes(assignee.toLowerCase()),
        )
        appliedFilters.push(`assignee: ${assignee}`)
      }
      if (sprint) {
        tickets = tickets.filter((t) => t.sprint?.name.toLowerCase().includes(sprint.toLowerCase()))
        appliedFilters.push(`sprint: ${sprint}`)
      }
      if (label) {
        tickets = tickets.filter((t) =>
          t.labels.some((l) => l.name.toLowerCase().includes(label.toLowerCase())),
        )
        appliedFilters.push(`label: ${label}`)
      }
      if (resolution) {
        if (resolution === 'resolved') {
          tickets = tickets.filter((t) => t.resolution != null)
          appliedFilters.push('resolution: resolved')
        } else if (resolution === 'unresolved') {
          tickets = tickets.filter((t) => t.resolution == null)
          appliedFilters.push('resolution: unresolved')
        } else {
          tickets = tickets.filter((t) => t.resolution?.toLowerCase() === resolution.toLowerCase())
          appliedFilters.push(`resolution: ${resolution}`)
        }
      }
      if (parent) {
        const parsedParent = parseTicketKey(parent)
        if (!parsedParent) {
          return errorResponse(
            `Invalid parent ticket key format: ${parent}. Expected format: PROJECT-123`,
          )
        }
        const parentNumber = parsedParent.number
        tickets = tickets.filter((t) => t.parent?.number === parentNumber)
        appliedFilters.push(`parent: ${parent.toUpperCase()}`)
      }
      if (missingFields && missingFields.length > 0) {
        const fieldChecks: Record<string, (t: TicketData) => boolean> = {
          storyPoints: (t) => t.storyPoints == null,
          assignee: (t) => t.assignee == null,
          sprint: (t) => t.sprint == null,
          labels: (t) => t.labels.length === 0,
          description: (t) => !t.description,
          estimate: (t) => !t.estimate,
          dueDate: (t) => !t.dueDate,
          startDate: (t) => !t.startDate,
          parent: (t) => t.parent == null,
        }
        tickets = tickets.filter((t) => missingFields.some((field) => fieldChecks[field](t)))
        appliedFilters.push(`missing: ${missingFields.join(', ')}`)
      }
      // Note: hasAttachments is filtered server-side (added to appliedFilters above)
      if (search) {
        const searchLower = search.toLowerCase()
        tickets = tickets.filter(
          (t) =>
            t.title.toLowerCase().includes(searchLower) ||
            (t.description?.toLowerCase().includes(searchLower) ?? false),
        )
        appliedFilters.push(`search: "${search}"`)
      }

      // Apply limit
      const totalBeforeLimit = tickets.length
      tickets = tickets.slice(0, limit)

      const filterNote =
        appliedFilters.length > 0 ? `Filters: ${appliedFilters.join(', ')}\n\n` : ''
      const limitNote =
        totalBeforeLimit > limit
          ? `\n\nShowing ${limit} of ${totalBeforeLimit} matching tickets.`
          : ''

      return textResponse(
        filterNote + formatTicketList(tickets, projectKey.toUpperCase()) + limitNote,
      )
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
      assignee: z.string().optional().describe('Assignee (name, username, or email)'),
      reporter: z
        .string()
        .optional()
        .describe('Reporter (name, username, or email; defaults to authenticated user)'),
      storyPoints: z.number().min(0).optional().describe('Story points'),
      estimate: z.string().optional().describe('Time estimate (e.g., "2h", "1d")'),
      startDate: z.string().optional().describe('Start date (ISO format: YYYY-MM-DD)'),
      dueDate: z.string().optional().describe('Due date (ISO format: YYYY-MM-DD)'),
      labels: z.array(z.string()).optional().describe('Label names to assign'),
      sprint: z.string().optional().describe('Sprint name to assign to'),
      resolution: z
        .enum([
          'Already Implemented',
          'Done',
          "Won't Fix",
          'Duplicate',
          'Cannot Reproduce',
          'Incomplete',
          "Won't Do",
        ])
        .nullable()
        .optional()
        .describe('Resolution (e.g., "Done", "Won\'t Fix", "Duplicate")'),
      environment: z.string().optional().describe('Environment (e.g., "Production")'),
      affectedVersion: z.string().optional().describe('Affected version'),
      fixVersion: z.string().optional().describe('Fix version'),
      parent: z
        .string()
        .optional()
        .describe('Parent ticket key (e.g., "PUNT-1") for creating subtasks'),
      context: z
        .string()
        .optional()
        .describe(
          'Context or reasoning for creating this ticket. When provided, this will be logged as a system comment on the ticket for audit trail purposes.',
        ),
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
      parent,
      context,
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
        const result = await resolveUser(assignee)
        if (result.error) return result.error
        assigneeId = result.user.id
      }

      // Get reporter ID if specified
      let reporterId: string | undefined
      if (reporter) {
        const result = await resolveUser(reporter)
        if (result.error) return result.error
        reporterId = result.user.id
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

      // Get parent ticket ID if specified
      let parentId: string | undefined
      if (parent) {
        const parsedParent = parseTicketKey(parent)
        if (!parsedParent) {
          return errorResponse(`Invalid parent ticket key format: ${parent}`)
        }
        // Validate parent is in the same project
        if (parsedParent.projectKey.toUpperCase() !== projectKey.toUpperCase()) {
          return errorResponse(`Parent ticket must be in the same project: ${parent}`)
        }
        const ticketsResult = await listTickets(projectKey)
        if (ticketsResult.error) {
          return errorResponse(ticketsResult.error)
        }
        const parentTicket = ticketsResult.data?.find((t) => t.number === parsedParent.number)
        if (!parentTicket) {
          return errorResponse(`Parent ticket not found: ${parent}`)
        }
        parentId = parentTicket.id
      }

      const result = await createTicket(projectKey, {
        title,
        description: description ?? null,
        type,
        priority,
        columnId,
        assigneeId: assigneeId ?? null,
        reporterId: reporterId ?? null,
        sprintId: sprintId ?? null,
        parentId: parentId ?? null,
        storyPoints: storyPoints ?? null,
        estimate: estimate ?? null,
        resolution: resolution ?? null,
        startDate: startDate ?? null,
        dueDate: dueDate ?? null,
        environment: environment ?? null,
        affectedVersion: affectedVersion ?? null,
        fixVersion: fixVersion ?? null,
        labelIds,
      })

      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = unwrapData(result)

      // If context was provided, create a system comment to log it
      if (context) {
        const commentResult = await createComment(projectKey, ticket.id, {
          content: `**MCP Context:**\n\n${context}`,
          isSystemGenerated: true,
          source: 'mcp',
        })
        // Log but don't fail if comment creation fails
        if (commentResult.error) {
          console.warn(`Failed to create context comment: ${commentResult.error}`)
        }
      }

      return textResponse(formatTicketCreated(ticket, projectKey.toUpperCase()))
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
      assignee: z
        .string()
        .nullable()
        .optional()
        .describe('New assignee (name, username, or email; null to unassign)'),
      storyPoints: z.number().min(0).nullable().optional().describe('New story points'),
      estimate: z.string().nullable().optional().describe('Time estimate'),
      startDate: z.string().nullable().optional().describe('Start date (null to clear)'),
      dueDate: z.string().nullable().optional().describe('Due date (null to clear)'),
      labels: z.array(z.string()).optional().describe('Label names (replaces existing)'),
      column: z.string().optional().describe('Move to column'),
      sprint: z.string().nullable().optional().describe('Sprint name (null for backlog)'),
      resolution: z
        .enum([
          'Already Implemented',
          'Done',
          "Won't Fix",
          'Duplicate',
          'Cannot Reproduce',
          'Incomplete',
          "Won't Do",
        ])
        .nullable()
        .optional()
        .describe('Resolution'),
      environment: z.string().nullable().optional().describe('Environment'),
      affectedVersion: z.string().nullable().optional().describe('Affected version'),
      fixVersion: z.string().nullable().optional().describe('Fix version'),
      parent: z
        .string()
        .nullable()
        .optional()
        .describe('Parent ticket key (e.g., "PUNT-1") or null to remove parent'),
      context: z
        .string()
        .optional()
        .describe(
          'Context or reasoning for this update. When provided, this will be logged as a system comment on the ticket for audit trail purposes.',
        ),
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
      parent,
      context,
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
          const result = await resolveUser(assignee)
          if (result.error) return result.error
          updateData.assigneeId = result.user.id
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

      // Handle parent
      if (parent !== undefined) {
        if (parent === null) {
          updateData.parentId = null
        } else {
          const parsedParent = parseTicketKey(parent)
          if (!parsedParent) {
            return errorResponse(`Invalid parent ticket key format: ${parent}`)
          }
          // Validate parent is in the same project
          if (parsedParent.projectKey.toUpperCase() !== parsed.projectKey.toUpperCase()) {
            return errorResponse(`Parent ticket must be in the same project: ${parent}`)
          }
          // Find parent ticket (we already fetched tickets above)
          const parentTicket = ticketsResult.data?.find((t) => t.number === parsedParent.number)
          if (!parentTicket) {
            return errorResponse(`Parent ticket not found: ${parent}`)
          }
          // Prevent setting ticket as its own parent
          if (parentTicket.id === existingTicket.id) {
            return errorResponse('A ticket cannot be its own parent')
          }
          updateData.parentId = parentTicket.id
        }
      }

      const result = await updateTicket(parsed.projectKey, existingTicket.id, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticket = unwrapData(result)

      // If context was provided, create a system comment to log it
      if (context) {
        const commentResult = await createComment(parsed.projectKey, ticket.id, {
          content: `**MCP Context:**\n\n${context}`,
          isSystemGenerated: true,
          source: 'mcp',
        })
        // Log but don't fail if comment creation fails
        if (commentResult.error) {
          console.warn(`Failed to create context comment: ${commentResult.error}`)
        }
      }

      const upperKey = parsed.projectKey.toUpperCase()
      return textResponse(
        formatTicketUpdated(`${upperKey}-${ticket.number}`, existingTicket, ticket),
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
        // Escape user-controlled column names
        changes.push(`${escapeMarkdown(existingTicket.column.name)} -> ${escapeMarkdown(col.name)}`)
      }

      // Handle sprint move
      if (sprint !== undefined) {
        if (sprint === null) {
          updateData.sprintId = null
          // Escape user-controlled sprint name
          const oldSprint = existingTicket.sprint?.name
            ? escapeMarkdown(existingTicket.sprint.name)
            : 'backlog'
          changes.push(`sprint: ${oldSprint} -> backlog`)
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
          // Escape user-controlled sprint names
          const oldSprint = existingTicket.sprint?.name
            ? escapeMarkdown(existingTicket.sprint.name)
            : 'backlog'
          changes.push(`sprint: ${oldSprint} -> ${escapeMarkdown(sp.name)}`)
        }
      }

      if (Object.keys(updateData).length === 0) {
        return errorResponse('No changes specified. Provide column or sprint.')
      }

      const result = await updateTicket(parsed.projectKey, existingTicket.id, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(`Moved **${key}**: ${changes.join(', ')}`)
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

      // Escape user-controlled ticket title
      return textResponse(`Deleted **${key}**: ${escapeMarkdown(existingTicket.title)}`)
    },
  )

  // list_comments - List all comments on a ticket
  server.tool(
    'list_comments',
    'List all comments on a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
    },
    async ({ key }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await listComments(parsed.projectKey, ticket.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      const comments = result.data ?? []
      if (comments.length === 0) {
        return textResponse(`No comments on **${key}**`)
      }

      return textResponse(formatCommentList(key, comments))
    },
  )

  // add_comment - Add a comment to a ticket
  server.tool(
    'add_comment',
    'Add a comment to a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      content: z.string().min(1).describe('Comment content (supports markdown)'),
    },
    async ({ key, content }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await createComment(parsed.projectKey, ticket.id, { content })
      if (result.error) {
        return errorResponse(result.error)
      }

      const comment = unwrapData(result)
      return textResponse(
        `Added comment to **${key}** by ${escapeMarkdown(comment.author.name)}:\n\n${escapeMarkdown(truncate(content, 200))}`,
      )
    },
  )

  // delete_comment - Delete a comment from a ticket
  server.tool(
    'delete_comment',
    'Delete a comment from a ticket (must be comment author or have moderation permissions)',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      commentId: z.string().describe('Comment ID to delete'),
    },
    async ({ key, commentId }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await deleteComment(parsed.projectKey, ticket.id, commentId)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(`Deleted comment from **${key}**`)
    },
  )

  // update_comment - Update a comment on a ticket
  server.tool(
    'update_comment',
    'Update a comment on a ticket (must be comment author)',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      commentId: z.string().describe('Comment ID to update'),
      content: z.string().min(1).describe('New comment content (supports markdown)'),
    },
    async ({ key, commentId, content }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await updateComment(parsed.projectKey, ticket.id, commentId, content)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(
        `Updated comment on **${key}**:\n\n${escapeMarkdown(truncate(content, 200))}`,
      )
    },
  )

  // search_tickets - Full-text search across tickets
  server.tool(
    'search_tickets',
    'Search tickets by text across title and description',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      query: z.string().min(1).describe('Search query'),
    },
    async ({ projectKey, query }) => {
      const result = await searchTickets(projectKey, query)
      if (result.error) {
        return errorResponse(result.error)
      }

      const tickets = result.data ?? []
      if (tickets.length === 0) {
        return textResponse(`No tickets found matching "${escapeMarkdown(query)}" in ${projectKey}`)
      }

      return textResponse(
        `## Search Results for "${escapeMarkdown(query)}" in ${projectKey}\n\n` +
          formatTicketList(tickets, projectKey),
      )
    },
  )

  // list_ticket_links - List all links for a ticket
  server.tool(
    'list_ticket_links',
    'List all links (blocks, relates to, duplicates, etc.) for a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
    },
    async ({ key }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await listTicketLinks(parsed.projectKey, ticket.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      const links = result.data ?? []
      if (links.length === 0) {
        return textResponse(`No links on **${key}**`)
      }

      return textResponse(formatTicketLinkList(key, parsed.projectKey, links))
    },
  )

  // add_ticket_link - Create a link between two tickets
  server.tool(
    'add_ticket_link',
    'Create a link between two tickets',
    {
      fromKey: z.string().describe('Source ticket key (e.g., PUNT-2)'),
      toKey: z.string().describe('Target ticket key (e.g., PUNT-5)'),
      linkType: z
        .enum(['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'])
        .describe('Type of link'),
    },
    async ({ fromKey, toKey, linkType }) => {
      const fromParsed = parseTicketKey(fromKey)
      const toParsed = parseTicketKey(toKey)

      if (!fromParsed) {
        return errorResponse(`Invalid ticket key format: ${fromKey}`)
      }
      if (!toParsed) {
        return errorResponse(`Invalid ticket key format: ${toKey}`)
      }

      // Get both tickets to find their IDs
      const fromTicketsResult = await listTickets(fromParsed.projectKey)
      if (fromTicketsResult.error) {
        return errorResponse(fromTicketsResult.error)
      }

      const fromTicket = fromTicketsResult.data?.find((t) => t.number === fromParsed.number)
      if (!fromTicket) {
        return errorResponse(`Ticket not found: ${fromKey}`)
      }

      // If same project, use same list; otherwise fetch the other project
      let toTicket: TicketData | undefined
      if (fromParsed.projectKey === toParsed.projectKey) {
        toTicket = fromTicketsResult.data?.find((t) => t.number === toParsed.number)
      } else {
        const toTicketsResult = await listTickets(toParsed.projectKey)
        if (toTicketsResult.error) {
          return errorResponse(toTicketsResult.error)
        }
        toTicket = toTicketsResult.data?.find((t) => t.number === toParsed.number)
      }

      if (!toTicket) {
        return errorResponse(`Ticket not found: ${toKey}`)
      }

      const result = await createTicketLink(fromParsed.projectKey, fromTicket.id, {
        targetTicketId: toTicket.id,
        linkType,
      })

      if (result.error) {
        return errorResponse(result.error)
      }

      const linkLabel = linkType.replace(/_/g, ' ')
      return textResponse(`Created link: **${fromKey}** ${linkLabel} **${toKey}**`)
    },
  )

  // remove_ticket_link - Remove a link between tickets
  server.tool(
    'remove_ticket_link',
    'Remove a link from a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-2)'),
      linkId: z.string().describe('Link ID to remove (from list_ticket_links)'),
    },
    async ({ key, linkId }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}`)
      }

      // Get the ticket to find its ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await deleteTicketLink(parsed.projectKey, ticket.id, linkId)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(`Removed link from **${key}**`)
    },
  )
}

/**
 * Format a list of ticket links for display
 */
function formatTicketLinkList(
  ticketKey: string,
  projectKey: string,
  links: TicketLinkData[],
): string {
  const lines: string[] = []
  lines.push(`## Links on ${ticketKey}`)
  lines.push('')

  // Group links by type and direction
  const grouped: Record<string, TicketLinkData[]> = {}
  for (const link of links) {
    // Include direction in grouping key for clarity
    const key = link.direction === 'inward' ? `is ${link.linkType} by` : link.linkType
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(link)
  }

  for (const [linkType, typeLinks] of Object.entries(grouped)) {
    const label = linkType.replace(/_/g, ' ')
    lines.push(`### ${label}`)
    for (const link of typeLinks) {
      const linkedKey = `${projectKey}-${link.linkedTicket.number}`
      lines.push(
        `- **${linkedKey}**: ${escapeMarkdown(link.linkedTicket.title)} _(${link.linkedTicket.type})_`,
      )
      lines.push(`  _Link ID: ${link.id}_`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format a list of comments for display
 */
function formatCommentList(ticketKey: string, comments: CommentData[]): string {
  const lines: string[] = []
  lines.push(`## Comments on ${ticketKey}`)
  lines.push('')

  for (const comment of comments) {
    const date = formatDate(comment.createdAt)
    const systemTag = comment.isSystemGenerated ? ` _(${comment.source || 'system'})_` : ''
    lines.push(`### ${escapeMarkdown(comment.author.name)}${systemTag} - ${date}`)
    lines.push(`_ID: ${comment.id}_`)
    lines.push('')
    lines.push(escapeMarkdown(comment.content))
    lines.push('')
  }

  return lines.join('\n')
}
