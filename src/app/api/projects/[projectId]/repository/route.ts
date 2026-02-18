import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { getSystemSettings } from '@/lib/system-settings'
import { REPO_PROVIDERS, type RepoProvider } from '@/types'

/**
 * Generate a secure random webhook secret.
 * Format: whsec_<32 random hex chars> (36 chars total)
 */
function generateWebhookSecret(): string {
  return `whsec_${randomBytes(16).toString('hex')}`
}

const environmentBranchSchema = z.object({
  id: z.string(),
  environment: z.string(),
  branchName: z.string(),
  color: z.string().optional(),
})

const commitPatternSchema = z.object({
  id: z.string(),
  pattern: z.string(), // The pattern text (e.g., "fixes", "closes", "wip")
  action: z.enum(['close', 'in_progress', 'reference']),
  isRegex: z.boolean().optional(), // Whether pattern is a regex
  enabled: z.boolean().optional(),
})

const updateRepositorySchema = z.object({
  repositoryUrl: z.string().url().nullable().optional(),
  repositoryProvider: z.enum(REPO_PROVIDERS).nullable().optional(),
  localPath: z.string().nullable().optional(),
  defaultBranch: z.string().nullable().optional(),
  branchTemplate: z.string().nullable().optional(),
  agentGuidance: z.string().nullable().optional(),
  monorepoPath: z.string().nullable().optional(),
  environmentBranches: z.array(environmentBranchSchema).nullable().optional(),
  commitPatterns: z.array(commitPatternSchema).nullable().optional(),
  // Webhook secret actions
  generateWebhookSecret: z.boolean().optional(), // Generate new secret
  clearWebhookSecret: z.boolean().optional(), // Remove secret
})

/**
 * GET /api/projects/[projectId]/repository - Get repository configuration
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params

    // Resolve project key to ID
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        key: true,
        name: true,
        repositoryUrl: true,
        repositoryProvider: true,
        localPath: true,
        defaultBranch: true,
        branchTemplate: true,
        agentGuidance: true,
        monorepoPath: true,
        environmentBranches: true,
        webhookSecret: true,
        commitPatterns: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get system defaults for effective values
    const systemSettings = await getSystemSettings()

    // Parse environmentBranches from JSON string
    let environmentBranches = null
    if (project.environmentBranches) {
      try {
        environmentBranches = JSON.parse(project.environmentBranches)
      } catch {
        environmentBranches = null
      }
    }

    // Parse commitPatterns from JSON string
    let commitPatterns = null
    if (project.commitPatterns) {
      try {
        commitPatterns = JSON.parse(project.commitPatterns)
      } catch {
        commitPatterns = null
      }
    }

    return NextResponse.json({
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      // Project-level settings
      repositoryUrl: project.repositoryUrl,
      repositoryProvider: project.repositoryProvider as RepoProvider | null,
      localPath: project.localPath,
      defaultBranch: project.defaultBranch,
      branchTemplate: project.branchTemplate,
      agentGuidance: project.agentGuidance,
      monorepoPath: project.monorepoPath,
      environmentBranches,
      commitPatterns,
      // Webhook integration (only expose whether secret exists, not the secret itself)
      hasWebhookSecret: !!project.webhookSecret,
      // Effective values (project settings with system defaults as fallback)
      effectiveBranchTemplate: project.branchTemplate ?? systemSettings.defaultBranchTemplate,
      effectiveAgentGuidance: project.agentGuidance ?? systemSettings.defaultAgentGuidance,
      // System defaults for reference
      systemDefaults: {
        branchTemplate: systemSettings.defaultBranchTemplate,
        agentGuidance: systemSettings.defaultAgentGuidance,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch repository config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[projectId]/repository - Update repository configuration
 * Requires PROJECT_SETTINGS permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params

    // Resolve project key to ID
    const projectId = await requireProjectByKey(projectKey)

    // Check project settings permission
    await requirePermission(user.id, projectId, PERMISSIONS.PROJECT_SETTINGS)

    const body = await request.json()
    const parsed = updateRepositorySchema.safeParse(body)

    if (!parsed.success) {
      console.error('Repository config validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const updates = parsed.data

    // Prepare data for database - stringify environmentBranches if present
    const dbData: Record<string, unknown> = {}

    // Copy over standard fields (excluding action flags)
    if (updates.repositoryUrl !== undefined) dbData.repositoryUrl = updates.repositoryUrl
    if (updates.repositoryProvider !== undefined)
      dbData.repositoryProvider = updates.repositoryProvider
    if (updates.localPath !== undefined) dbData.localPath = updates.localPath
    if (updates.defaultBranch !== undefined) dbData.defaultBranch = updates.defaultBranch
    if (updates.branchTemplate !== undefined) dbData.branchTemplate = updates.branchTemplate
    if (updates.agentGuidance !== undefined) dbData.agentGuidance = updates.agentGuidance
    if (updates.monorepoPath !== undefined) dbData.monorepoPath = updates.monorepoPath
    if (updates.environmentBranches !== undefined) {
      dbData.environmentBranches = updates.environmentBranches
        ? JSON.stringify(updates.environmentBranches)
        : null
    }
    if (updates.commitPatterns !== undefined) {
      dbData.commitPatterns = updates.commitPatterns ? JSON.stringify(updates.commitPatterns) : null
    }

    // Handle webhook secret actions
    let newWebhookSecret: string | null = null
    if (updates.generateWebhookSecret) {
      newWebhookSecret = generateWebhookSecret()
      dbData.webhookSecret = newWebhookSecret
    } else if (updates.clearWebhookSecret) {
      dbData.webhookSecret = null
    }

    const project = await db.project.update({
      where: { id: projectId },
      data: dbData,
      select: {
        id: true,
        key: true,
        name: true,
        repositoryUrl: true,
        repositoryProvider: true,
        localPath: true,
        defaultBranch: true,
        branchTemplate: true,
        agentGuidance: true,
        monorepoPath: true,
        environmentBranches: true,
        webhookSecret: true,
        commitPatterns: true,
      },
    })

    // Get system defaults for effective values
    const systemSettings = await getSystemSettings()

    // Parse environmentBranches from JSON string
    let parsedEnvironmentBranches = null
    if (project.environmentBranches) {
      try {
        parsedEnvironmentBranches = JSON.parse(project.environmentBranches)
      } catch {
        parsedEnvironmentBranches = null
      }
    }

    // Parse commitPatterns from JSON string
    let parsedCommitPatterns = null
    if (project.commitPatterns) {
      try {
        parsedCommitPatterns = JSON.parse(project.commitPatterns)
      } catch {
        parsedCommitPatterns = null
      }
    }

    return NextResponse.json({
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      // Project-level settings
      repositoryUrl: project.repositoryUrl,
      repositoryProvider: project.repositoryProvider as RepoProvider | null,
      localPath: project.localPath,
      defaultBranch: project.defaultBranch,
      branchTemplate: project.branchTemplate,
      agentGuidance: project.agentGuidance,
      monorepoPath: project.monorepoPath,
      environmentBranches: parsedEnvironmentBranches,
      commitPatterns: parsedCommitPatterns,
      // Webhook integration
      hasWebhookSecret: !!project.webhookSecret,
      // Only return the secret when it was just generated (for copying)
      ...(newWebhookSecret ? { webhookSecret: newWebhookSecret } : {}),
      // Effective values
      effectiveBranchTemplate: project.branchTemplate ?? systemSettings.defaultBranchTemplate,
      effectiveAgentGuidance: project.agentGuidance ?? systemSettings.defaultAgentGuidance,
      // System defaults
      systemDefaults: {
        branchTemplate: systemSettings.defaultBranchTemplate,
        agentGuidance: systemSettings.defaultAgentGuidance,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update repository config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
