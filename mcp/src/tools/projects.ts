import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import { errorResponse, formatProject, formatProjectList, textResponse } from '../utils.js'

export function registerProjectTools(server: McpServer) {
  // list_projects - List all projects
  server.tool(
    'list_projects',
    'List all projects',
    {
      limit: z.number().min(1).max(100).default(20).describe('Max results to return'),
    },
    async ({ limit }) => {
      const projects = await db.project.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          color: true,
          _count: {
            select: { tickets: true },
          },
        },
        orderBy: { name: 'asc' },
        take: limit,
      })

      return textResponse(formatProjectList(projects))
    },
  )

  // get_project - Get project details
  server.tool(
    'get_project',
    'Get project details including columns',
    {
      key: z.string().describe('Project key (e.g., PUNT)'),
    },
    async ({ key }) => {
      const project = await db.project.findUnique({
        where: { key: key.toUpperCase() },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          color: true,
          columns: {
            select: { id: true, name: true, order: true },
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { tickets: true, members: true },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${key}`)
      }

      return textResponse(formatProject(project))
    },
  )
}
