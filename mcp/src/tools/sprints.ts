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
        },
        orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
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
}
