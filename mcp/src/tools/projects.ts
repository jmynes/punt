import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import { errorResponse, formatProject, formatProjectList, textResponse } from '../utils.js'

// Default columns for new projects
const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done']

// Default colors for projects
const PROJECT_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
]

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
            select: { tickets: true, members: true },
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
    'Get project details including columns and members',
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
          members: {
            select: {
              user: { select: { id: true, name: true, email: true } },
              role: { select: { name: true } },
            },
          },
          _count: {
            select: { tickets: true, members: true },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${key}`)
      }

      // Format with members
      const lines: string[] = []
      lines.push(`# ${project.key}: ${project.name}`)
      lines.push('')
      if (project.description) {
        lines.push(project.description)
        lines.push('')
      }
      lines.push('| Field | Value |')
      lines.push('|-------|-------|')
      lines.push(`| Color | ${project.color} |`)
      lines.push(`| Tickets | ${project._count.tickets} |`)
      lines.push(`| Members | ${project._count.members} |`)

      if (project.columns.length > 0) {
        lines.push('')
        lines.push('## Columns')
        lines.push('')
        for (const col of project.columns) {
          lines.push(`${col.order + 1}. ${col.name}`)
        }
      }

      if (project.members.length > 0) {
        lines.push('')
        lines.push('## Members')
        lines.push('')
        lines.push('| Name | Role |')
        lines.push('|------|------|')
        for (const m of project.members) {
          lines.push(`| ${m.user.name} | ${m.role.name} |`)
        }
      }

      return textResponse(lines.join('\n'))
    },
  )

  // create_project - Create a new project
  server.tool(
    'create_project',
    'Create a new project',
    {
      name: z.string().min(1).describe('Project name'),
      key: z.string().min(2).max(10).describe('Project key (2-10 uppercase letters/numbers)'),
      description: z.string().optional().describe('Project description'),
      color: z.string().optional().describe('Project color (hex, e.g., #3b82f6)'),
    },
    async ({ name, key, description, color }) => {
      const projectKey = key.toUpperCase()

      // Validate key format
      if (!/^[A-Z][A-Z0-9]*$/.test(projectKey)) {
        return errorResponse(
          'Project key must start with a letter and contain only letters/numbers',
        )
      }

      // Check if key already exists
      const existing = await db.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      })
      if (existing) {
        return errorResponse(`Project key already exists: ${projectKey}`)
      }

      // Pick a random color if not specified
      const projectColor =
        color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]

      // Create project with default columns
      const project = await db.project.create({
        data: {
          name,
          key: projectKey,
          description: description || null,
          color: projectColor,
          columns: {
            create: DEFAULT_COLUMNS.map((colName, index) => ({
              name: colName,
              order: index,
            })),
          },
        },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          color: true,
          columns: {
            select: { name: true, order: true },
            orderBy: { order: 'asc' },
          },
          _count: { select: { tickets: true, members: true } },
        },
      })

      return textResponse(`Created project ${project.key}\n\n${formatProject(project)}`)
    },
  )

  // update_project - Update a project
  server.tool(
    'update_project',
    'Update a project',
    {
      key: z.string().describe('Project key (e.g., PUNT)'),
      name: z.string().optional().describe('New project name'),
      description: z.string().nullable().optional().describe('New description (null to clear)'),
      color: z.string().optional().describe('New color (hex)'),
    },
    async ({ key, name, description, color }) => {
      const project = await db.project.findUnique({
        where: { key: key.toUpperCase() },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${key}`)
      }

      const data: Record<string, unknown> = {}
      if (name !== undefined) data.name = name
      if (description !== undefined) data.description = description
      if (color !== undefined) data.color = color

      if (Object.keys(data).length === 0) {
        return errorResponse('No changes specified')
      }

      const updated = await db.project.update({
        where: { id: project.id },
        data,
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          color: true,
          columns: {
            select: { name: true, order: true },
            orderBy: { order: 'asc' },
          },
          _count: { select: { tickets: true, members: true } },
        },
      })

      return textResponse(`Updated project ${updated.key}\n\n${formatProject(updated)}`)
    },
  )

  // delete_project - Delete a project
  server.tool(
    'delete_project',
    'Delete a project and all its data (tickets, sprints, etc.)',
    {
      key: z.string().describe('Project key (e.g., PUNT)'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ key, confirm }) => {
      if (!confirm) {
        return errorResponse('Set confirm=true to delete the project')
      }

      const project = await db.project.findUnique({
        where: { key: key.toUpperCase() },
        select: { id: true, name: true, _count: { select: { tickets: true } } },
      })

      if (!project) {
        return errorResponse(`Project not found: ${key}`)
      }

      // Delete in order due to foreign key constraints
      await db.$transaction(async (tx) => {
        // Delete ticket-related data
        await tx.ticketWatcher.deleteMany({
          where: { ticket: { projectId: project.id } },
        })
        await tx.comment.deleteMany({
          where: { ticket: { projectId: project.id } },
        })
        await tx.attachment.deleteMany({
          where: { ticket: { projectId: project.id } },
        })
        await tx.ticketEdit.deleteMany({
          where: { ticket: { projectId: project.id } },
        })
        await tx.ticketLink.deleteMany({
          where: {
            OR: [
              { fromTicket: { projectId: project.id } },
              { toTicket: { projectId: project.id } },
            ],
          },
        })
        await tx.ticketSprintHistory.deleteMany({
          where: { ticket: { projectId: project.id } },
        })

        // Delete tickets
        await tx.ticket.deleteMany({ where: { projectId: project.id } })

        // Delete sprints
        await tx.sprint.deleteMany({ where: { projectId: project.id } })

        // Delete labels
        await tx.label.deleteMany({ where: { projectId: project.id } })

        // Delete columns
        await tx.column.deleteMany({ where: { projectId: project.id } })

        // Delete members and roles
        await tx.projectMember.deleteMany({ where: { projectId: project.id } })
        await tx.role.deleteMany({ where: { projectId: project.id } })

        // Delete sprint settings
        await tx.projectSprintSettings.deleteMany({ where: { projectId: project.id } })

        // Delete invitations
        await tx.invitation.deleteMany({ where: { projectId: project.id } })

        // Finally delete the project
        await tx.project.delete({ where: { id: project.id } })
      })

      return textResponse(
        `Deleted project ${key}: ${project.name} (${project._count.tickets} tickets removed)`,
      )
    },
  )
}
