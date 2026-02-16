import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getRepositoryConfig,
  getTicket,
  type RepositoryConfigData,
  type TicketData,
  unwrapData,
} from '../api-client.js'
import { errorResponse, escapeMarkdown, textResponse } from '../utils.js'

// Type for getTicket result
type TicketResult = Awaited<ReturnType<typeof getTicket>>

// Type guard for successful ticket result
function isTicketError(result: TicketResult): result is { error: string } {
  return 'error' in result && typeof result.error === 'string'
}

// Map issue types to conventional commit/branch prefixes
const ISSUE_TYPE_TO_BRANCH_PREFIX: Record<string, string> = {
  epic: 'feat',
  story: 'feat',
  task: 'chore',
  bug: 'fix',
  subtask: 'chore',
}

/**
 * Convert a string to a URL-safe slug.
 */
function slugify(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '')
}

/**
 * Generate a branch name from a template and ticket context.
 */
function generateBranchName(
  template: string,
  projectKey: string,
  ticketNumber: number,
  ticketType: string,
  ticketTitle: string,
): string {
  const slug = slugify(ticketTitle)
  const prefix = ISSUE_TYPE_TO_BRANCH_PREFIX[ticketType] ?? 'chore'

  return template
    .replace(/\{key\}/gi, `${projectKey.toLowerCase()}-${ticketNumber}`)
    .replace(/\{number\}/gi, String(ticketNumber))
    .replace(/\{type\}/gi, prefix)
    .replace(/\{slug\}/gi, slug)
    .replace(/\{project\}/gi, projectKey.toLowerCase())
    .replace(/-+/g, '-')
    .replace(/-$/g, '')
}

/**
 * Format repository context for display.
 */
function formatRepositoryContext(
  config: RepositoryConfigData,
  ticketContext?: {
    ticketKey: string
    ticketNumber: number
    ticketType: string
    ticketTitle: string
  },
): string {
  const lines: string[] = []

  lines.push(`## Repository Context: ${escapeMarkdown(config.projectName)} (${config.projectKey})`)
  lines.push('')

  // Repository connection details
  if (config.repositoryUrl || config.localPath) {
    lines.push('### Repository')
    if (config.repositoryUrl) {
      lines.push(`- **URL:** ${config.repositoryUrl}`)
    }
    if (config.repositoryProvider) {
      lines.push(`- **Provider:** ${config.repositoryProvider}`)
    }
    if (config.localPath) {
      lines.push(`- **Local Path:** \`${config.localPath}\``)
    }
    if (config.defaultBranch) {
      lines.push(`- **Default Branch:** ${config.defaultBranch}`)
    }
    if (config.monorepoPath) {
      lines.push(`- **Monorepo Path:** \`${config.monorepoPath}\``)
    }
    lines.push('')
  }

  // Branch naming
  lines.push('### Branch Naming')
  lines.push(`- **Template:** \`${config.effectiveBranchTemplate}\``)

  if (ticketContext) {
    const suggestedBranch = generateBranchName(
      config.effectiveBranchTemplate,
      config.projectKey,
      ticketContext.ticketNumber,
      ticketContext.ticketType,
      ticketContext.ticketTitle,
    )
    lines.push(`- **Suggested Branch:** \`${suggestedBranch}\``)
  }
  lines.push('')

  // Environment branches
  if (config.environmentBranches && config.environmentBranches.length > 0) {
    lines.push('### Environment Branches')
    for (const branch of config.environmentBranches) {
      lines.push(`- **${branch.environment}:** \`${branch.branchName}\``)
    }
    lines.push('')
  }

  // Agent guidance
  if (config.effectiveAgentGuidance) {
    lines.push('### Agent Guidance')
    lines.push('')
    lines.push(config.effectiveAgentGuidance)
    lines.push('')
  }

  // Ticket context summary
  if (ticketContext) {
    lines.push('### Current Ticket')
    lines.push(`- **Key:** ${ticketContext.ticketKey}`)
    lines.push(`- **Type:** ${ticketContext.ticketType}`)
    lines.push(`- **Title:** ${escapeMarkdown(ticketContext.ticketTitle)}`)
    lines.push('')
  }

  return lines.join('\n')
}

export function registerRepositoryTools(server: McpServer) {
  // get_repo_context - Get repository context for AI agents
  server.tool(
    'get_repo_context',
    'Get repository context for AI agents working on a project. Includes repository URL, local path, branch template, agent guidance, and optionally a suggested branch name for a specific ticket.',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      ticketNumber: z
        .number()
        .optional()
        .describe('Optional ticket number to generate a suggested branch name'),
    },
    async ({ projectKey, ticketNumber }) => {
      // Get repository configuration
      const configResult = await getRepositoryConfig(projectKey)
      if (configResult.error) {
        return errorResponse(configResult.error)
      }

      const config = unwrapData(configResult)

      // If ticket number provided, fetch ticket details for branch generation
      let ticketContext:
        | {
            ticketKey: string
            ticketNumber: number
            ticketType: string
            ticketTitle: string
          }
        | undefined

      if (ticketNumber) {
        const ticketResult = await getTicket(projectKey, ticketNumber)
        if (isTicketError(ticketResult)) {
          // Don't fail the whole request, just skip ticket context
          console.warn(
            `Could not fetch ticket ${projectKey}-${ticketNumber}: ${ticketResult.error}`,
          )
        } else if (ticketResult.data) {
          const ticket = ticketResult.data
          ticketContext = {
            ticketKey: `${projectKey}-${ticket.number}`,
            ticketNumber: ticket.number,
            ticketType: ticket.type,
            ticketTitle: ticket.title,
          }
        }
      }

      return textResponse(formatRepositoryContext(config, ticketContext))
    },
  )

  // get_branch_name - Generate a branch name for a ticket
  server.tool(
    'get_branch_name',
    'Generate a branch name for a specific ticket using the project branch template.',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      ticketNumber: z.number().describe('Ticket number'),
    },
    async ({ projectKey, ticketNumber }) => {
      // Get repository configuration
      const configResult = await getRepositoryConfig(projectKey)
      if (configResult.error) {
        return errorResponse(configResult.error)
      }

      const config = unwrapData(configResult)

      // Get ticket details
      const ticketResult = await getTicket(projectKey, ticketNumber)
      if (isTicketError(ticketResult)) {
        return errorResponse(ticketResult.error)
      }

      if (!ticketResult.data) {
        return errorResponse('Ticket not found')
      }

      const ticket = ticketResult.data

      const branchName = generateBranchName(
        config.effectiveBranchTemplate,
        projectKey,
        ticket.number,
        ticket.type,
        ticket.title,
      )

      return textResponse(`Branch name for ${projectKey}-${ticketNumber}: \`${branchName}\``)
    },
  )
}
