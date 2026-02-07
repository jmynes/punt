import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import { errorResponse, formatSprint, formatSprintList, textResponse } from '../utils.js'

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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const where: Record<string, unknown> = { projectId: project.id }
      if (status) {
        where.status = status
      }

      const sprints = await db.sprint.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          goal: true,
          startDate: true,
          endDate: true,
          budget: true,
          _count: { select: { tickets: true } },
        },
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { name: 'asc' }],
      })

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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const sprint = await db.sprint.findFirst({
        where: {
          projectId: project.id,
          name: { contains: sprintName },
        },
        select: {
          id: true,
          name: true,
          status: true,
          goal: true,
          startDate: true,
          endDate: true,
          budget: true,
          completedTicketCount: true,
          incompleteTicketCount: true,
          completedStoryPoints: true,
          incompleteStoryPoints: true,
          tickets: {
            select: {
              id: true,
              number: true,
              title: true,
              type: true,
              priority: true,
              storyPoints: true,
              column: { select: { name: true } },
              assignee: { select: { name: true } },
            },
            orderBy: [{ column: { order: 'asc' } }, { order: 'asc' }],
          },
        },
      })

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      return textResponse(formatSprint({ ...sprint, project }))
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Check for duplicate name
      const existing = await db.sprint.findFirst({
        where: { projectId: project.id, name },
        select: { id: true },
      })
      if (existing) {
        return errorResponse(`Sprint already exists: ${name}`)
      }

      const sprint = await db.sprint.create({
        data: {
          name,
          goal: goal || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          budget: budget || null,
          status: 'planning',
          projectId: project.id,
        },
        select: {
          id: true,
          name: true,
          status: true,
          goal: true,
          startDate: true,
          endDate: true,
          budget: true,
        },
      })

      return textResponse(
        `Created sprint "${sprint.name}"\n\n${formatSprint({ ...sprint, project, tickets: [] })}`,
      )
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const sprint = await db.sprint.findFirst({
        where: { projectId: project.id, name: { contains: sprintName } },
        select: { id: true },
      })

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      const data: Record<string, unknown> = {}
      if (name !== undefined) data.name = name
      if (goal !== undefined) data.goal = goal
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
      if (budget !== undefined) data.budget = budget

      if (Object.keys(data).length === 0) {
        return errorResponse('No changes specified')
      }

      const updated = await db.sprint.update({
        where: { id: sprint.id },
        data,
        select: {
          id: true,
          name: true,
          status: true,
          goal: true,
          startDate: true,
          endDate: true,
          budget: true,
        },
      })

      return textResponse(
        `Updated sprint "${updated.name}"\n\n${formatSprint({ ...updated, project, tickets: [] })}`,
      )
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const sprint = await db.sprint.findFirst({
        where: { projectId: project.id, name: { contains: sprintName } },
        select: { id: true, status: true, name: true },
      })

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      if (sprint.status !== 'planning') {
        return errorResponse(`Sprint "${sprint.name}" is already ${sprint.status}`)
      }

      // Check for existing active sprint
      const activeSprint = await db.sprint.findFirst({
        where: { projectId: project.id, status: 'active' },
        select: { name: true },
      })

      if (activeSprint) {
        return errorResponse(`Cannot start sprint: "${activeSprint.name}" is already active`)
      }

      const updated = await db.sprint.update({
        where: { id: sprint.id },
        data: {
          status: 'active',
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : undefined,
        },
        select: {
          id: true,
          name: true,
          status: true,
          goal: true,
          startDate: true,
          endDate: true,
          budget: true,
          _count: { select: { tickets: true } },
        },
      })

      return textResponse(
        `Started sprint "${updated.name}" with ${updated._count.tickets} tickets\n\n${formatSprint({ ...updated, project, tickets: [] })}`,
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          sprintSettings: { select: { doneColumnIds: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const sprint = await db.sprint.findFirst({
        where: { projectId: project.id, name: { contains: sprintName } },
        select: {
          id: true,
          status: true,
          name: true,
          tickets: {
            select: { id: true, columnId: true, storyPoints: true },
          },
        },
      })

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      if (sprint.status !== 'active') {
        return errorResponse(`Sprint "${sprint.name}" is not active (status: ${sprint.status})`)
      }

      // Parse done column IDs
      const doneColumnIds: string[] = project.sprintSettings?.doneColumnIds
        ? JSON.parse(project.sprintSettings.doneColumnIds as string)
        : []

      // Separate completed and incomplete tickets
      const completedTickets = sprint.tickets.filter((t) => doneColumnIds.includes(t.columnId))
      const incompleteTickets = sprint.tickets.filter((t) => !doneColumnIds.includes(t.columnId))

      // Calculate metrics
      const completedCount = completedTickets.length
      const incompleteCount = incompleteTickets.length
      const completedPoints = completedTickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
      const incompletePoints = incompleteTickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0)

      // Find next sprint if needed
      let nextSprintId: string | null = null
      if (moveIncompleteTo === 'next' && incompleteTickets.length > 0) {
        const nextSprint = await db.sprint.findFirst({
          where: { projectId: project.id, status: 'planning' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        nextSprintId = nextSprint?.id || null
      }

      // Update sprint and tickets
      await db.$transaction(async (tx) => {
        // Complete the sprint
        await tx.sprint.update({
          where: { id: sprint.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            completedTicketCount: completedCount,
            incompleteTicketCount: incompleteCount,
            completedStoryPoints: completedPoints,
            incompleteStoryPoints: incompletePoints,
          },
        })

        // Move incomplete tickets
        if (incompleteTickets.length > 0) {
          await tx.ticket.updateMany({
            where: { id: { in: incompleteTickets.map((t) => t.id) } },
            data: {
              sprintId: nextSprintId,
              isCarriedOver: nextSprintId !== null,
              carriedFromSprintId: nextSprintId !== null ? sprint.id : null,
            },
          })
        }
      })

      const destination = moveIncompleteTo === 'next' && nextSprintId ? 'next sprint' : 'backlog'

      return textResponse(
        `Completed sprint "${sprint.name}"\n\n` +
          `- Completed: ${completedCount} tickets (${completedPoints} points)\n` +
          `- Incomplete: ${incompleteCount} tickets (${incompletePoints} points) → ${destination}`,
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

      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const sprint = await db.sprint.findFirst({
        where: { projectId: project.id, name: { contains: sprintName } },
        select: { id: true, name: true, _count: { select: { tickets: true } } },
      })

      if (!sprint) {
        return errorResponse(`Sprint not found: ${sprintName}`)
      }

      await db.$transaction(async (tx) => {
        // Move tickets to backlog
        await tx.ticket.updateMany({
          where: { sprintId: sprint.id },
          data: { sprintId: null },
        })

        // Delete sprint history
        await tx.ticketSprintHistory.deleteMany({
          where: { sprintId: sprint.id },
        })

        // Delete the sprint
        await tx.sprint.delete({ where: { id: sprint.id } })
      })

      return textResponse(
        `Deleted sprint "${sprint.name}" (${sprint._count.tickets} tickets moved to backlog)`,
      )
    },
  )
}
