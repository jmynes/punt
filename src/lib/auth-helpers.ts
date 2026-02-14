import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { DEMO_USER, isDemoMode } from '@/lib/demo'
import type { Permission } from '@/lib/permissions'
import {
  hasAnyPermission as checkAnyPermission,
  hasPermission as checkPermission,
  getEffectivePermissions,
  isMember,
} from '@/lib/permissions/check'

/**
 * Check if the current request is authenticated via MCP API key.
 * Looks up the user by their mcpApiKey field in the database.
 * Returns the user if found and active, null otherwise.
 */
async function getMcpUser() {
  const headersList = await headers()
  const apiKey = headersList.get('X-MCP-API-Key')

  if (!apiKey) {
    return null
  }

  // Look up user by their MCP API key
  const user = await db.user.findUnique({
    where: { mcpApiKey: apiKey },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  // Only return active users
  if (user?.isActive) {
    return user
  }

  return null
}

/**
 * Get the current user from server-side session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  // Check for MCP API key first (internal service calls)
  const mcpUser = await getMcpUser()
  if (mcpUser) {
    return mcpUser
  }

  // Demo mode: return demo user
  if (isDemoMode()) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      avatar: DEMO_USER.avatar,
      isSystemAdmin: DEMO_USER.isSystemAdmin,
      isActive: DEMO_USER.isActive,
    }
  }

  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  return user
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (!user.isActive) {
    throw new Error('Account disabled')
  }

  return user
}

/**
 * Require system admin - throws if not system admin
 */
export async function requireSystemAdmin() {
  const user = await requireAuth()

  if (!user.isSystemAdmin) {
    throw new Error('Forbidden: System admin required')
  }

  return user
}

/**
 * Check if a user is a system admin
 */
async function isUserSystemAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  })
  return user?.isSystemAdmin ?? false
}

/**
 * Get a user's project membership
 * Returns null if user is not a member
 */
export async function getProjectMembership(userId: string, projectId: string) {
  return db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: { select: { name: true } } },
  })
}

/**
 * Resolve a project key (e.g., "PUNT") to its database ID
 * Returns the project ID if found, null otherwise
 */
export async function resolveProjectKey(keyOrId: string): Promise<string | null> {
  // First try to find by exact key match (keys are stored uppercase)
  const projectByKey = await db.project.findUnique({
    where: { key: keyOrId.toUpperCase() },
    select: { id: true },
  })

  if (projectByKey) {
    return projectByKey.id
  }

  // Fallback: check if it's a valid project ID (for backwards compatibility)
  const projectById = await db.project.findUnique({
    where: { id: keyOrId },
    select: { id: true },
  })

  return projectById?.id ?? null
}

/**
 * Resolve a project key to ID, throwing 404 if not found
 */
export async function requireProjectByKey(keyOrId: string): Promise<string> {
  const projectId = await resolveProjectKey(keyOrId)
  if (!projectId) {
    throw new Error('Project not found')
  }
  return projectId
}

/**
 * Require project membership - throws if not a member
 * System admins have unrestricted access to all projects
 */
export async function requireProjectMember(userId: string, projectId: string) {
  // System admins bypass membership checks - they have virtual owner access
  if (await isUserSystemAdmin(userId)) {
    return { role: 'owner' as const }
  }

  const membership = await getProjectMembership(userId, projectId)
  if (!membership) {
    throw new Error('Forbidden: Not a project member')
  }
  return membership
}

/**
 * Require project admin role - throws if not admin or owner
 * System admins have unrestricted access to all projects
 */
export async function requireProjectAdmin(userId: string, projectId: string) {
  // System admins bypass membership checks - they have virtual owner access
  if (await isUserSystemAdmin(userId)) {
    return { role: 'owner' as const }
  }

  const membership = await getProjectMembership(userId, projectId)
  if (!membership) {
    throw new Error('Forbidden: Not a project member')
  }
  if (membership.role.name !== 'Owner' && membership.role.name !== 'Admin') {
    throw new Error('Forbidden: Admin role required')
  }
  return membership
}

/**
 * Require project owner role - throws if not owner
 * System admins have unrestricted access to all projects
 * @deprecated Use requirePermission() with specific permissions instead
 */
export async function requireProjectOwner(userId: string, projectId: string) {
  // System admins bypass membership checks - they have virtual owner access
  if (await isUserSystemAdmin(userId)) {
    return { role: 'owner' as const }
  }

  const membership = await getProjectMembership(userId, projectId)
  if (!membership) {
    throw new Error('Forbidden: Not a project member')
  }
  if (membership.role.name !== 'Owner') {
    throw new Error('Forbidden: Owner role required')
  }
  return membership
}

// ============================================================================
// New Granular Permission System
// ============================================================================

/**
 * Require a specific permission - throws if not authorized
 */
export async function requirePermission(userId: string, projectId: string, permission: Permission) {
  const hasAccess = await checkPermission(userId, projectId, permission)
  if (!hasAccess) {
    throw new Error(`Forbidden: Missing permission ${permission}`)
  }
  return true
}

/**
 * Require any of the specified permissions - throws if none are present
 */
export async function requireAnyPermission(
  userId: string,
  projectId: string,
  permissions: Permission[],
) {
  const hasAccess = await checkAnyPermission(userId, projectId, permissions)
  if (!hasAccess) {
    throw new Error('Forbidden: Missing required permissions')
  }
  return true
}

/**
 * Require project membership (any role) - throws if not a member
 * This is the minimum check for accessing project resources
 */
export async function requireMembership(userId: string, projectId: string) {
  const membershipExists = await isMember(userId, projectId)
  if (!membershipExists) {
    throw new Error('Forbidden: Not a project member')
  }
  return true
}

/**
 * Context-aware permission check for "own" vs "any" resources.
 * Used for tickets, comments, attachments where ownership matters.
 */
export async function requireResourcePermission(
  userId: string,
  projectId: string,
  resourceOwnerId: string | null,
  ownPermission: Permission,
  anyPermission: Permission,
) {
  const { permissions, isSystemAdmin } = await getEffectivePermissions(userId, projectId)

  // System admins can do anything
  if (isSystemAdmin) return true

  // Check "any" permission first
  if (permissions.has(anyPermission)) return true

  // Check "own" permission if resource is owned by user
  if (resourceOwnerId === userId && permissions.has(ownPermission)) {
    return true
  }

  throw new Error(`Forbidden: Missing permission to modify this resource`)
}

/**
 * Check ticket edit/delete permissions based on ownership.
 */
export async function requireTicketPermission(
  userId: string,
  projectId: string,
  ticketCreatorId: string | null,
  _action: 'edit' | 'delete',
) {
  const ownPermission = 'tickets.manage_own' as Permission
  const anyPermission = 'tickets.manage_any' as Permission

  return requireResourcePermission(userId, projectId, ticketCreatorId, ownPermission, anyPermission)
}

/**
 * Check comment edit/delete permissions based on ownership.
 */
export async function requireCommentPermission(
  userId: string,
  projectId: string,
  commentAuthorId: string | null,
  _action: 'edit' | 'delete',
) {
  // Users can always edit/delete their own comments (implicit permission)
  if (commentAuthorId === userId) {
    return true
  }

  // For others' comments, need moderation permission
  const anyPermission = 'comments.manage_any' as Permission
  const { permissions, isSystemAdmin } = await getEffectivePermissions(userId, projectId)

  if (isSystemAdmin || permissions.has(anyPermission)) {
    return true
  }

  throw new Error('Forbidden: Cannot modify this comment')
}

/**
 * Check attachment delete permissions based on ownership.
 */
export async function requireAttachmentPermission(
  userId: string,
  projectId: string,
  attachmentUploaderId: string | null,
  _action: 'delete',
) {
  // Users can always delete their own attachments (implicit permission)
  if (attachmentUploaderId === userId) {
    return true
  }

  // For others' attachments, need moderation permission
  const anyPermission = 'attachments.manage_any' as Permission
  const { permissions, isSystemAdmin } = await getEffectivePermissions(userId, projectId)

  if (isSystemAdmin || permissions.has(anyPermission)) {
    return true
  }

  throw new Error('Forbidden: Cannot delete this attachment')
}

// Re-export Permission type for convenience
export type { Permission }
