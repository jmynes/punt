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
import { errorResponse, textResponse } from '../utils.js'

/**
 * Format a sprint for display
 */
function formatSprint(sprint: SprintData, projectKey?: string): string {
  const lines: string[] = []

  lines.push(`# ${sprint.name}`)
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Status | ${sprint.status} |`)

  if (sprint.goal) {
    lines.push(`| Goal | ${sprint.goal} |`)
  }

  if (sprint.startDate) {
    lines.push(`| Start | ${new Date(sprint.startDate).toISOString().split('T')[0]} |`)
  }

  if (sprint.endDate) {
    lines.push(`| End | ${new Date(sprint.endDate).toISOString().split('T')[0]} |`)
  }

  if (sprint.budget !== null) {
    lines.push(`| Capacity | ${sprint.budget} points |`)
  }

  if (sprint.tickets && sprint.tickets.length > 0) {
    lines.push('')
    lines.push('## Tickets')
    lines.push('')
    lines.push('| Key | Title | Type | Priority | Status | Assignee | Points |')
    lines.push('|-----|-------|------|----------|--------|----------|--------|')

    for (const t of sprint.tickets) {
      const key = projectKey ? `${projectKey}-${t.number}` : `#${t.number}`
      const title = t.title.length > 35 ? `${t.title.slice(0, 35)}...` : t.title
      const assignee = t.assignee?.name ?? '-'
      const points = t.storyPoints ?? '-'

      lines.push(
        `| ${key} | ${title} | ${t.type} | ${t.priority} | ${t.column.name} | ${assignee} | ${points} |`,
      )
    }

    lines.push('')
    lines.push(`Total: ${sprint.tickets.length} ticket(s)`)
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
    const goal = s.goal ?? '-'
    const start = s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '-'
    const end = s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : '-'
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

      // Filter by status if specified
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
      // First list sprints to find the sprint by name
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

      // Get full sprint details
      const result = await getSprint(projectKey, sprint.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      // biome-ignore lint/style/noNonNullAssertion: data is guaranteed present when no error
      return textResponse(formatSprint(result.data!, projectKey.toUpperCase()))
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
      const sprint = result.data!
      return textResponse(`Created sprint "${sprint.name}"\n\n${formatSprint(sprint)}`)
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
      // Find sprint by name
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
      const updated = result.data!
      return textResponse(`Updated sprint "${updated.name}"\n\n${formatSprint(updated)}`)
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
      // Find sprint by name
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
      return textResponse(
        `Started sprint "${started.name}" with ${ticketCount} tickets\n\n${formatSprint(started)}`,
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
      // Find sprint by name
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
        `Completed sprint "${sprint.name}"\n\nIncomplete tickets moved to ${destination}`,
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

      // Find sprint by name
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
        `Deleted sprint "${sprint.name}" (${ticketCount} tickets moved to backlog)`,
      )
    },
  )
}
