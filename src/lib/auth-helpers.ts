import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Get the current user from server-side session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
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
    select: { role: true },
  })
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
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Error('Forbidden: Admin role required')
  }
  return membership
}

/**
 * Require project owner role - throws if not owner
 * System admins have unrestricted access to all projects
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
  if (membership.role !== 'owner') {
    throw new Error('Forbidden: Owner role required')
  }
  return membership
}
