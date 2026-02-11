import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  completeSprint,
  createSprint,
  deleteSprint,
  getSprint,
  listSprints,
  type SprintData,
  startSprint,
  updateSprint,
} from '../api-client.js'
import { errorResponse, formatDate, formatTicketList, textResponse } from '../utils.js'

/**
 * Format a sprint for detailed display (get_sprint).
 * Uses compact key-value layout with ticket table.
 */
function formatSprintDetail(sprint: SprintData, projectKey?: string): string {
  const lines: string[] = []

  lines.push(`## ${sprint.name}`)
  lines.push('')

  lines.push(`**Status:** ${sprint.status}  `)
  if (sprint.goal) lines.push(`**Goal:** ${sprint.goal}  `)
  if (sprint.startDate) lines.push(`**Start:** ${formatDate(sprint.startDate)}  `)
  if (sprint.endDate) lines.push(`**End:** ${formatDate(sprint.endDate)}  `)
  if (sprint.budget !== null) lines.push(`**Capacity:** ${sprint.budget} points  `)

  if (sprint.tickets && sprint.tickets.length > 0) {
    lines.push('')
    lines.push(formatTicketList(sprint.tickets, projectKey))
  } else if (sprint.tickets) {
    lines.push('')
    lines.push('No tickets in this sprint.')
  }

  return lines.join('\n')
}

/**
 * Format a compact summary for a newly created sprint.
 */
function formatSprintCreated(sprint: SprintData): string {
  const lines: string[] = []
  lines.push(`Created sprint **"${sprint.name}"**`)
  lines.push('')

  lines.push(`**Status:** ${sprint.status}  `)
  if (sprint.goal) lines.push(`**Goal:** ${sprint.goal}  `)
  if (sprint.startDate) lines.push(`**Start:** ${formatDate(sprint.startDate)}  `)
  if (sprint.endDate) lines.push(`**End:** ${formatDate(sprint.endDate)}  `)
  if (sprint.budget !== null) lines.push(`**Capacity:** ${sprint.budget} points  `)

  return lines.join('\n')
}

/**
 * Format a diff-style view of what changed on a sprint update.
 */
function formatSprintUpdated(oldSprint: SprintData, newSprint: SprintData): string {
  const lines: string[] = []
  lines.push(`Updated sprint **"${newSprint.name}"**`)
  lines.push('')

  const changes: string[] = []

  if (oldSprint.name !== newSprint.name) {
    changes.push(`**Name:** ${oldSprint.name} -> ${newSprint.name}`)
  }
  if (oldSprint.status !== newSprint.status) {
    changes.push(`**Status:** ${oldSprint.status} -> ${newSprint.status}`)
  }
  if ((oldSprint.goal ?? null) !== (newSprint.goal ?? null)) {
    if (!newSprint.goal) {
      changes.push('**Goal:** cleared')
    } else if (!oldSprint.goal) {
      changes.push(`**Goal:** added "${newSprint.goal}"`)
    } else {
      changes.push(`**Goal:** "${oldSprint.goal}" -> "${newSprint.goal}"`)
    }
  }
  if ((oldSprint.startDate ?? null) !== (newSprint.startDate ?? null)) {
    const oldVal = oldSprint.startDate ? formatDate(oldSprint.startDate) : 'none'
    const newVal = newSprint.startDate ? formatDate(newSprint.startDate) : 'none'
    changes.push(`**Start:** ${oldVal} -> ${newVal}`)
  }
  if ((oldSprint.endDate ?? null) !== (newSprint.endDate ?? null)) {
    const oldVal = oldSprint.endDate ? formatDate(oldSprint.endDate) : 'none'
    const newVal = newSprint.endDate ? formatDate(newSprint.endDate) : 'none'
    changes.push(`**End:** ${oldVal} -> ${newVal}`)
  }
  if (oldSprint.budget !== newSprint.budget) {
    changes.push(
      `**Capacity:** ${oldSprint.budget ?? 'none'} -> ${newSprint.budget ?? 'none'} points`,
    )
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

/**
 * Format a list of sprints for display
 */
function formatSprintList(sprints: SprintData[]): string {
  if (sprints.length === 0) {
    return 'No sprints found.'
  }

  const lines: string[] = []
  lines.push('| Name | Status | Goal | Start | End |')
  lines.push('|------|--------|------|-------|-----|')

  for (const s of sprints) {
    const goal = s.goal ? (s.goal.length > 30 ? `${s.goal.slice(0, 27)}...` : s.goal) : '-'
    const start = s.startDate ? formatDate(s.startDate) : '-'
    const end = s.endDate ? formatDate(s.endDate) : '-'
    lines.push(`| ${s.name} | ${s.status} | ${goal} | ${start} | ${end} |`)
  }

  lines.push('')
  lines.push(`Total: ${sprints.length} sprint(s)`)

  return lines.join('\n')
}

export function registerSprintTools(server: McpServer) {
  // list_sprints - List sprints for a project
  server.tool(
    'list_sprints',
    'List sprints for a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      status: z.enum(['planning', 'active', 'completed']).optional().describe('Filter by status'),
    },
    async ({ projectKey, status }) => {
      const result = await listSprints(projectKey)
      if (result.error) {
        return errorResponse(result.error)
      }

      let sprints = result.data || []

      if (status) {
        sprints = sprints.filter((s) => s.status === status)
      }

      return textResponse(formatSprintList(sprints))
    },
  )

  // get_sprint - Get sprint with tickets
  server.tool(
    'get_sprint',
    'Get sprint details with tickets',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      sprintName: z.string().describe('Sprint name'),
    },
    async ({ projectKey, sprintName }) => {
      const listResult = await listSprints(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const sprint = listResult.data?.find((s) =>
        s.name.toLowerCase().includes(sprintName.toLowerCase()),
      )

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      const result = await getSprint(projectKey, sprint.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      // biome-ignore lint/style/noNonNullAssertion: data is guaranteed present when no error
      return textResponse(formatSprintDetail(result.data!, projectKey.toUpperCase()))
    },
  )

  // create_sprint - Create a new sprint
  server.tool(
    'create_sprint',
    'Create a new sprint in a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      name: z.string().min(1).describe('Sprint name'),
      goal: z.string().optional().describe('Sprint goal'),
      startDate: z.string().optional().describe('Start date (ISO: YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (ISO: YYYY-MM-DD)'),
      budget: z.number().min(0).optional().describe('Story points capacity'),
    },
    async ({ projectKey, name, goal, startDate, endDate, budget }) => {
      const result = await createSprint(projectKey, {
        name,
        goal: goal ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        budget: budget ?? null,
      })

      if (result.error) {
        return errorResponse(result.error)
      }

      // biome-ignore lint/style/noNonNullAssertion: data is guaranteed present when no error
      return textResponse(formatSprintCreated(result.data!))
    },
  )

  // update_sprint - Update a sprint
  server.tool(
    'update_sprint',
    'Update a sprint',
    {
      projectKey: z.string().describe('Project key'),
      sprintName: z.string().describe('Sprint name to update'),
      name: z.string().optional().describe('New sprint name'),
      goal: z.string().nullable().optional().describe('New goal (null to clear)'),
      startDate: z.string().nullable().optional().describe('New start date'),
      endDate: z.string().nullable().optional().describe('New end date'),
      budget: z.number().min(0).nullable().optional().describe('New capacity'),
    },
    async ({ projectKey, sprintName, name, goal, startDate, endDate, budget }) => {
      const listResult = await listSprints(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const sprint = listResult.data?.find((s) =>
        s.name.toLowerCase().includes(sprintName.toLowerCase()),
      )

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (goal !== undefined) updateData.goal = goal
      if (startDate !== undefined) updateData.startDate = startDate
      if (endDate !== undefined) updateData.endDate = endDate
      if (budget !== undefined) updateData.budget = budget

      if (Object.keys(updateData).length === 0) {
        return errorResponse('No changes specified')
      }

      const result = await updateSprint(projectKey, sprint.id, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      // biome-ignore lint/style/noNonNullAssertion: data is guaranteed present when no error
      return textResponse(formatSprintUpdated(sprint, result.data!))
    },
  )

  // start_sprint - Start a planning sprint
  server.tool(
    'start_sprint',
    'Start a sprint (changes status from planning to active)',
    {
      projectKey: z.string().describe('Project key'),
      sprintName: z.string().describe('Sprint name to start'),
      startDate: z.string().optional().describe('Start date (defaults to today)'),
      endDate: z.string().optional().describe('End date'),
    },
    async ({ projectKey, sprintName, startDate, endDate }) => {
      const listResult = await listSprints(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const sprint = listResult.data?.find((s) =>
        s.name.toLowerCase().includes(sprintName.toLowerCase()),
      )

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      if (sprint.status !== 'planning') {
        return errorResponse(`Sprint "${sprint.name}" is already ${sprint.status}`)
      }

      const result = await startSprint(projectKey, sprint.id, { startDate, endDate })
      if (result.error) {
        return errorResponse(result.error)
      }

      // biome-ignore lint/style/noNonNullAssertion: data is guaranteed present when no error
      const started = result.data!
      const ticketCount = started.tickets?.length ?? 0
      const dateRange =
        started.startDate && started.endDate
          ? ` (${formatDate(started.startDate)} - ${formatDate(started.endDate)})`
          : ''
      return textResponse(
        `Started sprint **"${started.name}"** with ${ticketCount} ticket(s)${dateRange}`,
      )
    },
  )

  // complete_sprint - Complete an active sprint
  server.tool(
    'complete_sprint',
    'Complete an active sprint',
    {
      projectKey: z.string().describe('Project key'),
      sprintName: z.string().describe('Sprint name to complete'),
      moveIncompleteTo: z
        .enum(['backlog', 'next'])
        .default('backlog')
        .describe('Where to move incomplete tickets'),
    },
    async ({ projectKey, sprintName, moveIncompleteTo }) => {
      const listResult = await listSprints(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const sprint = listResult.data?.find((s) =>
        s.name.toLowerCase().includes(sprintName.toLowerCase()),
      )

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      if (sprint.status !== 'active') {
        return errorResponse(`Sprint "${sprint.name}" is not active (status: ${sprint.status})`)
      }

      const result = await completeSprint(projectKey, sprint.id, { moveIncompleteTo })
      if (result.error) {
        return errorResponse(result.error)
      }

      const destination = moveIncompleteTo === 'next' ? 'next sprint' : 'backlog'
      return textResponse(
        `Completed sprint **"${sprint.name}"**. Incomplete tickets moved to ${destination}.`,
      )
    },
  )

  // delete_sprint - Delete a sprint
  server.tool(
    'delete_sprint',
    'Delete a sprint (moves tickets to backlog)',
    {
      projectKey: z.string().describe('Project key'),
      sprintName: z.string().describe('Sprint name to delete'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ projectKey, sprintName, confirm }) => {
      if (!confirm) {
        return errorResponse('Set confirm=true to delete the sprint')
      }

      const listResult = await listSprints(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const sprint = listResult.data?.find((s) =>
        s.name.toLowerCase().includes(sprintName.toLowerCase()),
      )

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      const result = await deleteSprint(projectKey, sprint.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticketCount = sprint.tickets?.length ?? 0
      return textResponse(
        `Deleted sprint **"${sprint.name}"** (${ticketCount} ticket(s) moved to backlog)`,
      )
    },
  )
}
