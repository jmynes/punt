/**
 * Default Role Creation
 *
 * Helper function to create the default roles for a new project.
 */

import { db } from '@/lib/db'
import { getDefaultRoleConfigs } from './presets'

/**
 * Create default roles for a project.
 * Returns a map of role name to role id for easy lookup.
 */
export async function createDefaultRolesForProject(
  projectId: string,
): Promise<Map<string, string>> {
  const configs = getDefaultRoleConfigs()
  const roleMap = new Map<string, string>()

  for (const config of configs) {
    const role = await db.role.create({
      data: {
        name: config.name,
        color: config.color,
        description: config.description,
        permissions: JSON.stringify(config.permissions),
        isDefault: config.isDefault,
        position: config.position,
        projectId,
      },
    })
    roleMap.set(config.name, role.id)
  }

  return roleMap
}

/**
 * Get the Owner role for a project.
 * Creates default roles if they don't exist.
 */
export async function getOwnerRoleForProject(projectId: string): Promise<string> {
  // Try to find existing Owner role
  const ownerRole = await db.role.findFirst({
    where: {
      projectId,
      name: 'Owner',
      isDefault: true,
    },
    select: { id: true },
  })

  if (!ownerRole) {
    // Create default roles if they don't exist
    const roleMap = await createDefaultRolesForProject(projectId)
    const ownerId = roleMap.get('Owner')
    if (!ownerId) {
      throw new Error('Failed to create Owner role')
    }
    return ownerId
  }

  return ownerRole.id
}

/**
 * Get a specific role by name for a project.
 */
export async function getRoleByName(
  projectId: string,
  roleName: string,
): Promise<{ id: string } | null> {
  return db.role.findFirst({
    where: {
      projectId,
      name: roleName,
    },
    select: { id: true },
  })
}

/**
 * Get the Member role for a project.
 * This is the default role for invited users.
 */
export async function getMemberRoleForProject(projectId: string): Promise<string> {
  const memberRole = await db.role.findFirst({
    where: {
      projectId,
      name: 'Member',
      isDefault: true,
    },
    select: { id: true },
  })

  if (!memberRole) {
    // Create default roles if they don't exist
    const roleMap = await createDefaultRolesForProject(projectId)
    const memberId = roleMap.get('Member')
    if (!memberId) {
      throw new Error('Failed to create Member role')
    }
    return memberId
  }

  return memberRole.id
}
