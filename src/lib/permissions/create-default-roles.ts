/**
 * Default Role Creation
 *
 * Helper function to create the default roles for a new project.
 */

import { db } from '@/lib/db'
import { isValidPermission, type Permission } from './constants'
import { type DefaultRoleName, getDefaultRoleConfigs, ROLE_POSITIONS } from './presets'

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

interface ExtraRoleConfig {
  id: string
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

interface ParsedRoleSettings {
  defaults: CustomRoleSettings
  customRoles: ExtraRoleConfig[]
}

/**
 * Get custom role settings from system settings.
 * Handles both old format (permission arrays) and new format (full config objects).
 * Also reads custom (non-default) roles from the _customRoles array.
 * Falls back to presets if not configured.
 */
async function getCustomRoleSettings(): Promise<ParsedRoleSettings | null> {
  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    if (settings?.defaultRolePermissions) {
      const parsed = JSON.parse(settings.defaultRolePermissions)
      const defaults: CustomRoleSettings = {}

      for (const role of ['Owner', 'Admin', 'Member'] as DefaultRoleName[]) {
        const value = parsed[role]
        if (!value) continue

        if (Array.isArray(value)) {
          // Old format: { "Owner": ["perm1", "perm2"] }
          defaults[role] = { permissions: value.filter(isValidPermission) }
        } else if (typeof value === 'object') {
          // New format: { "Owner": { permissions: [...], color: "...", ... } }
          defaults[role] = {}
          if (typeof value.name === 'string' && value.name.trim()) {
            defaults[role].name = value.name.trim()
          }
          if (Array.isArray(value.permissions)) {
            defaults[role].permissions = value.permissions.filter(isValidPermission)
          }
          if (typeof value.color === 'string') {
            defaults[role].color = value.color
          }
          if (typeof value.description === 'string') {
            defaults[role].description = value.description
          }
          if (typeof value.position === 'number') {
            defaults[role].position = value.position
          }
        }
      }

      // Parse custom roles
      const customRoles: ExtraRoleConfig[] = []
      if (Array.isArray(parsed._customRoles)) {
        for (const r of parsed._customRoles) {
          if (typeof r === 'object' && r !== null && typeof r.name === 'string') {
            customRoles.push({
              id: r.id ?? '',
              name: r.name.trim(),
              permissions: Array.isArray(r.permissions)
                ? r.permissions.filter(isValidPermission)
                : [],
              color: typeof r.color === 'string' ? r.color : '#6b7280',
              description: typeof r.description === 'string' ? r.description : '',
              position: typeof r.position === 'number' ? r.position : 100,
            })
          }
        }
      }

      return { defaults, customRoles }
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
  const parsedSettings = await getCustomRoleSettings()
  const roleMap = new Map<string, string>()

  // Create the 3 built-in default roles
  for (const config of configs) {
    const custom = parsedSettings?.defaults[config.name as DefaultRoleName]

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

  // Create any custom default roles configured in admin settings
  if (parsedSettings?.customRoles) {
    for (const customRole of parsedSettings.customRoles) {
      const role = await db.role.create({
        data: {
          name: customRole.name,
          color: customRole.color,
          description: customRole.description,
          permissions: JSON.stringify(customRole.permissions),
          isDefault: false,
          position: customRole.position,
          projectId,
        },
      })
      roleMap.set(customRole.name, role.id)
    }
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
