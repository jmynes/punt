import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  createProject,
  deleteProject,
  getProject,
  getRepositoryConfig,
  listProjects,
  type ProjectData,
  type RepositoryConfigData,
  unwrapData,
  updateProject,
} from '../api-client.js'
import { errorResponse, escapeMarkdown, safeTableCell, textResponse } from '../utils.js'

/**
 * Project colors for auto-assignment when not specified.
 * These are pleasant, distinct colors suitable for project identification.
 */
const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
  '#14b8a6', // teal
]

/**
 * Pick a random color from the project colors palette.
 */
function getRandomProjectColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

/**
 * Format a project for detailed display (get_project).
 * Uses compact key-value layout with sections.
 */
function formatProjectDetail(project: ProjectData, repoConfig?: RepositoryConfigData): string {
  const lines: string[] = []
  // Escape user-controlled project name
  lines.push(`## ${project.key}: ${escapeMarkdown(project.name)}`)
  lines.push('')

  if (project.description) {
    // Escape user-controlled description
    lines.push(escapeMarkdown(project.description))
    lines.push('')
  }

  lines.push(`**Color:** ${project.color}  `)
  if (project._count) {
    lines.push(`**Tickets:** ${project._count.tickets}  `)
    lines.push(`**Members:** ${project._count.members}  `)
  }

  if (project.columns && project.columns.length > 0) {
    lines.push('')
    // Escape user-controlled column names
    lines.push(`**Columns:** ${project.columns.map((c) => escapeMarkdown(c.name)).join(' -> ')}`)
  }

  if (project.members && project.members.length > 0) {
    lines.push('')
    lines.push('**Members:**')
    for (const m of project.members) {
      // Escape user-controlled user and role names
      lines.push(`- ${escapeMarkdown(m.user.name)} (${escapeMarkdown(m.role.name)})`)
    }
  }

  // Repository configuration
  if (repoConfig && (repoConfig.repositoryUrl || repoConfig.localPath)) {
    lines.push('')
    lines.push('**Repository:**')
    if (repoConfig.repositoryUrl) {
      lines.push(`- URL: ${repoConfig.repositoryUrl}`)
    }
    if (repoConfig.localPath) {
      lines.push(`- Local Path: \`${repoConfig.localPath}\``)
    }
    if (repoConfig.defaultBranch) {
      lines.push(`- Default Branch: ${repoConfig.defaultBranch}`)
    }
    if (repoConfig.monorepoPath) {
      lines.push(`- Monorepo Path: \`${repoConfig.monorepoPath}\``)
    }
    lines.push(`- Branch Template: \`${repoConfig.effectiveBranchTemplate}\``)
  }

  return lines.join('\n')
}

/**
 * Format a compact summary for a newly created project.
 */
function formatProjectCreated(project: ProjectData): string {
  const lines: string[] = []
  // Escape user-controlled project name
  lines.push(`Created project **${project.key}**: ${escapeMarkdown(project.name)}`)
  lines.push('')

  const fields: string[] = []
  fields.push(`**Color:** ${project.color}`)
  // Escape user-controlled description
  if (project.description) fields.push(`**Description:** ${escapeMarkdown(project.description)}`)

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
    // Escape user-controlled project names
    changes.push(
      `**Name:** ${escapeMarkdown(oldProject.name)} -> ${escapeMarkdown(newProject.name)}`,
    )
  }
  if ((oldProject.description ?? null) !== (newProject.description ?? null)) {
    if (!newProject.description) {
      changes.push('**Description:** cleared')
    } else if (!oldProject.description) {
      // Escape user-controlled description
      changes.push(`**Description:** added "${escapeMarkdown(newProject.description)}"`)
    } else {
      // Escape user-controlled descriptions
      changes.push(
        `**Description:** "${escapeMarkdown(oldProject.description)}" -> "${escapeMarkdown(newProject.description)}"`,
      )
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
    // Escape user-controlled project name for safe table rendering
    const name = safeTableCell(p.name, 30)
    const tickets = p._count?.tickets ?? '-'
    const members = p._count?.members ?? '-'
    lines.push(`| ${p.key} | ${name} | ${tickets} | ${members} |`)
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
    'Get project details including columns, members, and repository configuration',
    {
      key: z.string().describe('Project key (e.g., PUNT)'),
    },
    async ({ key }) => {
      const result = await getProject(key)
      if (result.error) {
        return errorResponse(result.error)
      }

      // Also fetch repository configuration
      const repoResult = await getRepositoryConfig(key)
      const repoConfig = repoResult.error ? undefined : unwrapData(repoResult)

      return textResponse(formatProjectDetail(unwrapData(result), repoConfig))
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
      color: z
        .string()
        .optional()
        .describe(
          'Project color (hex, e.g., #3b82f6). If not provided, a random color is assigned.',
        ),
    },
    async ({ name, key, description, color }) => {
      // Auto-assign a random color if not provided (API requires color)
      const projectColor = color ?? getRandomProjectColor()

      const result = await createProject({
        name,
        key: key.toUpperCase(),
        description,
        color: projectColor,
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

      // Escape user-controlled project name
      return textResponse(
        `Deleted project **${key}**: ${escapeMarkdown(project.name)} (${project._count?.tickets ?? 0} tickets removed)`,
      )
    },
  )
}
