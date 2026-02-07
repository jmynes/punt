/**
 * Permission Checking Utilities
 *
 * Functions for checking user permissions in projects.
 * Handles role-based permissions with optional per-member overrides.
 */

import { db } from '@/lib/db'
import { ALL_PERMISSIONS, type Permission, parsePermissions } from './constants'

// Type for membership with role data
export interface MembershipWithRole {
  id: string
  roleId: string
  overrides: string | null
  userId: string
  projectId: string
  role: {
    id: string
    name: string
    permissions: string
    isDefault: boolean
  }
}

// Effective permissions result
export interface EffectivePermissions {
  permissions: Set<Permission>
  membership: MembershipWithRole | null
  isSystemAdmin: boolean
}

/**
 * Get a user's effective permissions in a project.
 * System admins get all permissions.
 * Regular users get role permissions + any overrides.
 */
export async function getEffectivePermissions(
  userId: string,
  projectId: string,
): Promise<EffectivePermissions> {
  // Check if user is a system admin
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  })

  if (user?.isSystemAdmin) {
    return {
      permissions: new Set(ALL_PERMISSIONS),
      membership: null,
      isSystemAdmin: true,
    }
  }

  // Get membership with role data
  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      id: true,
      roleId: true,
      overrides: true,
      userId: true,
      projectId: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
          isDefault: true,
        },
      },
    },
  })

  if (!membership) {
    return {
      permissions: new Set(),
      membership: null,
      isSystemAdmin: false,
    }
  }

  // Parse role permissions
  const rolePermissions = parsePermissions(membership.role.permissions)

  // Parse member overrides (additive)
  const overridePermissions = parsePermissions(membership.overrides)

  // Combine: role permissions + overrides
  const effectivePermissions = new Set([...rolePermissions, ...overridePermissions])

  return {
    permissions: effectivePermissions,
    membership,
    isSystemAdmin: false,
  }
}

/**
 * Check if a user has a specific permission in a project.
 */
export async function hasPermission(
  userId: string,
  projectId: string,
  permission: Permission,
): Promise<boolean> {
  const { permissions } = await getEffectivePermissions(userId, projectId)
  return permissions.has(permission)
}

/**
 * Check if a user has any of the specified permissions.
 */
export async function hasAnyPermission(
  userId: string,
  projectId: string,
  requiredPermissions: Permission[],
): Promise<boolean> {
  const { permissions } = await getEffectivePermissions(userId, projectId)
  return requiredPermissions.some((p) => permissions.has(p))
}

/**
 * Check if a user has all of the specified permissions.
 */
export async function hasAllPermissions(
  userId: string,
  projectId: string,
  requiredPermissions: Permission[],
): Promise<boolean> {
  const { permissions } = await getEffectivePermissions(userId, projectId)
  return requiredPermissions.every((p) => permissions.has(p))
}

/**
 * Check if a user is a member of a project (any role).
 * System admins are considered virtual members.
 */
export async function isMember(userId: string, projectId: string): Promise<boolean> {
  // Check system admin first
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  })

  if (user?.isSystemAdmin) {
    return true
  }

  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { id: true },
  })

  return membership !== null
}

/**
 * Get all permissions for a role (parsed from JSON).
 */
export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { permissions: true },
  })

  if (!role) return []
  return parsePermissions(role.permissions)
}

/**
 * Check if a user can manage another user's membership.
 * Owner can manage anyone. Admin can manage non-admins/non-owners.
 * This is used for role changes and member removal.
 */
export async function canManageMember(
  actorUserId: string,
  targetUserId: string,
  projectId: string,
): Promise<boolean> {
  // Can't manage yourself (use separate leave/transfer functions)
  if (actorUserId === targetUserId) {
    return false
  }

  const actorPerms = await getEffectivePermissions(actorUserId, projectId)

  // Must have members.manage permission
  if (!actorPerms.permissions.has('members.manage' as Permission)) {
    return false
  }

  // System admins can manage anyone
  if (actorPerms.isSystemAdmin) {
    return true
  }

  // Get actor's role position
  const actorMembership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: actorUserId, projectId } },
    select: { role: { select: { position: true } } },
  })

  // Get target's role position
  const targetMembership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: targetUserId, projectId } },
    select: { role: { select: { position: true } } },
  })

  if (!actorMembership || !targetMembership) {
    return false
  }

  // Can only manage users with lower rank (higher position number)
  return actorMembership.role.position < targetMembership.role.position
}

/**
 * Check if a user can assign a specific role to members.
 * Users can only assign roles of lower rank than their own.
 */
export async function canAssignRole(
  actorUserId: string,
  projectId: string,
  targetRoleId: string,
): Promise<boolean> {
  const actorPerms = await getEffectivePermissions(actorUserId, projectId)

  // Must have members.manage permission
  if (!actorPerms.permissions.has('members.manage' as Permission)) {
    return false
  }

  // System admins can assign any role
  if (actorPerms.isSystemAdmin) {
    return true
  }

  // Get actor's role position
  const actorMembership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: actorUserId, projectId } },
    select: { role: { select: { position: true } } },
  })

  // Get target role position
  const targetRole = await db.role.findUnique({
    where: { id: targetRoleId },
    select: { position: true },
  })

  if (!actorMembership || !targetRole) {
    return false
  }

  // Can only assign roles of lower rank (higher position number)
  return actorMembership.role.position < targetRole.position
}
