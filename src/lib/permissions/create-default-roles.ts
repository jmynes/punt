/**
 * Default Role Creation
 *
 * Helper function to create the default roles for a new project.
 */

import { db } from '@/lib/db'
import { isValidPermission, type Permission } from './constants'
import {
  type DefaultRoleName,
  getDefaultRoleConfigs,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from './presets'

interface CustomRoleConfig {
  name?: string
  permissions?: Permission[]
  color?: string
  description?: string
  position?: number
}

type CustomRoleSettings = {
  [K in DefaultRoleName]?: CustomRoleConfig
}

/**
 * Get custom role settings from system settings.
 * Handles both old format (permission arrays) and new format (full config objects).
 * Falls back to presets if not configured.
 */
async function getCustomRoleSettings(): Promise<CustomRoleSettings | null> {
  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    if (settings?.defaultRolePermissions) {
      const parsed = JSON.parse(settings.defaultRolePermissions)
      const result: CustomRoleSettings = {}

      for (const role of ['Owner', 'Admin', 'Member'] as DefaultRoleName[]) {
        const value = parsed[role]
        if (!value) continue

        if (Array.isArray(value)) {
          // Old format: { "Owner": ["perm1", "perm2"] }
          result[role] = { permissions: value.filter(isValidPermission) }
        } else if (typeof value === 'object') {
          // New format: { "Owner": { permissions: [...], color: "...", ... } }
          result[role] = {}
          if (typeof value.name === 'string' && value.name.trim()) {
            result[role].name = value.name.trim()
          }
          if (Array.isArray(value.permissions)) {
            result[role].permissions = value.permissions.filter(isValidPermission)
          }
          if (typeof value.color === 'string') {
            result[role].color = value.color
          }
          if (typeof value.description === 'string') {
            result[role].description = value.description
          }
          if (typeof value.position === 'number') {
            result[role].position = value.position
          }
        }
      }

      return result
    }
  } catch {
    // Fall back to presets on error
  }
  return null
}

/**
 * Create default roles for a project.
 * Returns a map of role name to role id for easy lookup.
 */
export async function createDefaultRolesForProject(
  projectId: string,
): Promise<Map<string, string>> {
  const configs = getDefaultRoleConfigs()
  const customSettings = await getCustomRoleSettings()
  const roleMap = new Map<string, string>()

  for (const config of configs) {
    const custom = customSettings?.[config.name as DefaultRoleName]

    const role = await db.role.create({
      data: {
        name: custom?.name ?? config.name,
        color: custom?.color ?? config.color,
        description: custom?.description ?? config.description,
        permissions: JSON.stringify(custom?.permissions ?? config.permissions),
        isDefault: config.isDefault,
        position: custom?.position ?? config.position,
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
 * Uses position instead of name to support renamed default roles.
 */
export async function getOwnerRoleForProject(projectId: string): Promise<string> {
  // Try to find existing Owner role by position (supports renamed defaults)
  const ownerRole = await db.role.findFirst({
    where: {
      projectId,
      position: ROLE_POSITIONS.Owner,
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
 * Uses position instead of name to support renamed default roles.
 */
export async function getMemberRoleForProject(projectId: string): Promise<string> {
  const memberRole = await db.role.findFirst({
    where: {
      projectId,
      position: ROLE_POSITIONS.Member,
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
