import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  type ProjectData,
  unwrapData,
  updateProject,
} from '../api-client.js'
import { errorResponse, textResponse } from '../utils.js'

/**
 * Format a project for detailed display (get_project).
 * Uses compact key-value layout with sections.
 */
function formatProjectDetail(project: ProjectData): string {
  const lines: string[] = []
  lines.push(`## ${project.key}: ${project.name}`)
  lines.push('')

  if (project.description) {
    lines.push(project.description)
    lines.push('')
  }

  lines.push(`**Color:** ${project.color}  `)
  if (project._count) {
    lines.push(`**Tickets:** ${project._count.tickets}  `)
    lines.push(`**Members:** ${project._count.members}  `)
  }

  if (project.columns && project.columns.length > 0) {
    lines.push('')
    lines.push(`**Columns:** ${project.columns.map((c) => c.name).join(' -> ')}`)
  }

  if (project.members && project.members.length > 0) {
    lines.push('')
    lines.push('**Members:**')
    for (const m of project.members) {
      lines.push(`- ${m.user.name} (${m.role.name})`)
    }
  }

  return lines.join('\n')
}

/**
 * Format a compact summary for a newly created project.
 */
function formatProjectCreated(project: ProjectData): string {
  const lines: string[] = []
  lines.push(`Created project **${project.key}**: ${project.name}`)
  lines.push('')

  const fields: string[] = []
  fields.push(`**Color:** ${project.color}`)
  if (project.description) fields.push(`**Description:** ${project.description}`)

  for (const f of fields) lines.push(`${f}  `)

  return lines.join('\n')
}

/**
 * Format a diff-style view of what changed on a project update.
 */
function formatProjectUpdated(
  key: string,
  oldProject: ProjectData,
  newProject: ProjectData,
): string {
  const lines: string[] = []
  lines.push(`Updated project **${key}**`)
  lines.push('')

  const changes: string[] = []

  if (oldProject.name !== newProject.name) {
    changes.push(`**Name:** ${oldProject.name} -> ${newProject.name}`)
  }
  if ((oldProject.description ?? null) !== (newProject.description ?? null)) {
    if (!newProject.description) {
      changes.push('**Description:** cleared')
    } else if (!oldProject.description) {
      changes.push(`**Description:** added "${newProject.description}"`)
    } else {
      changes.push(`**Description:** "${oldProject.description}" -> "${newProject.description}"`)
    }
  }
  if (oldProject.color !== newProject.color) {
    changes.push(`**Color:** ${oldProject.color} -> ${newProject.color}`)
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
 * Format a list of projects for display
 */
function formatProjectList(projects: ProjectData[]): string {
  if (projects.length === 0) {
    return 'No projects found.'
  }

  const lines: string[] = []
  lines.push('| Key | Name | Tickets | Members |')
  lines.push('|-----|------|---------|---------|')

  for (const p of projects) {
    const tickets = p._count?.tickets ?? '-'
    const members = p._count?.members ?? '-'
    lines.push(`| ${p.key} | ${p.name} | ${tickets} | ${members} |`)
  }

  lines.push('')
  lines.push(`Total: ${projects.length} project(s)`)

  return lines.join('\n')
}

export function registerProjectTools(server: McpServer) {
  // list_projects - List all projects
  server.tool(
    'list_projects',
    'List all projects',
    {
      limit: z.number().min(1).max(100).default(20).describe('Max results to return'),
    },
    async ({ limit }) => {
      const result = await listProjects()
      if (result.error) {
        return errorResponse(result.error)
      }

      const projects = (result.data || []).slice(0, limit)
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
      const result = await getProject(key)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(formatProjectDetail(unwrapData(result)))
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
      const result = await createProject({
        name,
        key: key.toUpperCase(),
        description,
        color,
      })

      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(formatProjectCreated(unwrapData(result)))
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
      // Get current project state for diff
      const currentResult = await getProject(key)
      if (currentResult.error) {
        return errorResponse(currentResult.error)
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (color !== undefined) updateData.color = color

      if (Object.keys(updateData).length === 0) {
        return errorResponse('No changes specified')
      }

      const result = await updateProject(key, updateData)
      if (result.error) {
        return errorResponse(result.error)
      }

      const oldProject = unwrapData(currentResult)
      const newProject = unwrapData(result)
      return textResponse(formatProjectUpdated(key.toUpperCase(), oldProject, newProject))
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

      const projectResult = await getProject(key)
      if (projectResult.error) {
        return errorResponse(projectResult.error)
      }

      const project = unwrapData(projectResult)
      const result = await deleteProject(key)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(
        `Deleted project **${key}**: ${project.name} (${project._count?.tickets ?? 0} tickets removed)`,
      )
    },
  )
}
