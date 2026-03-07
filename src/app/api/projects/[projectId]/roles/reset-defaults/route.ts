import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import {
  ALL_PERMISSIONS,
  isValidPermission,
  PERMISSIONS,
  type Permission,
  parsePermissions,
} from '@/lib/permissions'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'

/** Full role config stored in admin settings DB */
interface RoleConfig {
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

interface CustomRoleConfig {
  id: string
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

type DefaultRoleSettings = Record<DefaultRoleName, RoleConfig>

/** Get hardcoded default role settings */
function getHardcodedDefaults(): DefaultRoleSettings {
  return {
    Owner: {
      name: 'Owner',
      permissions: [...ROLE_PRESETS.Owner],
      color: ROLE_COLORS.Owner,
      description: ROLE_DESCRIPTIONS.Owner,
      position: ROLE_POSITIONS.Owner,
    },
    Admin: {
      name: 'Admin',
      permissions: [...ROLE_PRESETS.Admin],
      color: ROLE_COLORS.Admin,
      description: ROLE_DESCRIPTIONS.Admin,
      position: ROLE_POSITIONS.Admin,
    },
    Member: {
      name: 'Member',
      permissions: [...ROLE_PRESETS.Member],
      color: ROLE_COLORS.Member,
      description: ROLE_DESCRIPTIONS.Member,
      position: ROLE_POSITIONS.Member,
    },
  }
}

/** Parse admin system settings to get default role configs */
function parseAdminRoleSettings(value: unknown): {
  defaults: DefaultRoleSettings
  customRoles: CustomRoleConfig[]
} {
  const defaults = getHardcodedDefaults()
  let customRoles: CustomRoleConfig[] = []

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value

    for (const role of ['Owner', 'Admin', 'Member'] as DefaultRoleName[]) {
      const val = parsed[role]
      if (!val) continue

      if (Array.isArray(val)) {
        defaults[role].permissions = val.filter(isValidPermission)
      } else if (typeof val === 'object') {
        if (Array.isArray(val.permissions)) {
          defaults[role].permissions = val.permissions.filter(isValidPermission)
        }
        if (typeof val.color === 'string') defaults[role].color = val.color
        if (typeof val.description === 'string') defaults[role].description = val.description
        if (typeof val.position === 'number') defaults[role].position = val.position
        if (typeof val.name === 'string' && val.name.trim()) defaults[role].name = val.name.trim()
      }
    }

    // Parse custom roles
    if (Array.isArray(parsed._customRoles)) {
      customRoles = parsed._customRoles
        .filter(
          (r: unknown) =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as Record<string, unknown>).id === 'string' &&
            typeof (r as Record<string, unknown>).name === 'string',
        )
        .map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name as string).trim(),
          permissions: Array.isArray(r.permissions)
            ? (r.permissions as string[]).filter(isValidPermission)
            : [],
          color: typeof r.color === 'string' ? r.color : '#6b7280',
          description: typeof r.description === 'string' ? r.description : '',
          position: typeof r.position === 'number' ? r.position : 100,
        }))
    }
  } catch {
    // Return defaults on parse error
  }

  return { defaults, customRoles }
}

/**
 * POST /api/projects/[projectId]/roles/reset-defaults
 * Reset project roles to match system admin defaults.
 * Updates the 3 built-in default roles and syncs custom default roles.
 * Requires members.admin permission.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

    // Fetch admin default role settings
    const systemSettings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    const { defaults, customRoles: defaultCustomRoles } = systemSettings?.defaultRolePermissions
      ? parseAdminRoleSettings(systemSettings.defaultRolePermissions)
      : { defaults: getHardcodedDefaults(), customRoles: [] }

    // Owner always has all permissions
    defaults.Owner.permissions = [...ALL_PERMISSIONS]

    // Update the 3 built-in default roles by position
    for (const [presetName, config] of Object.entries(defaults)) {
      const targetPosition = ROLE_POSITIONS[presetName as DefaultRoleName]

      await db.role.updateMany({
        where: {
          projectId,
          isDefault: true,
          position: targetPosition,
        },
        data: {
          name: config.name,
          permissions: config.permissions,
          color: config.color,
          description: config.description,
        },
      })
    }

    // Delete existing non-default (custom) roles that are NOT in the system custom defaults
    // We match by name to decide what to keep vs recreate
    const existingCustomRoles = await db.role.findMany({
      where: { projectId, isDefault: false },
      select: { id: true, name: true },
    })

    const defaultCustomRoleNames = new Set(defaultCustomRoles.map((r) => r.name))

    // Delete custom roles that don't match system defaults (only those without members)
    for (const existing of existingCustomRoles) {
      if (!defaultCustomRoleNames.has(existing.name)) {
        // Check if role has members before deleting
        const memberCount = await db.projectMember.count({
          where: { roleId: existing.id },
        })
        if (memberCount === 0) {
          await db.role.delete({ where: { id: existing.id } })
        }
      }
    }

    // Refresh existing custom roles after deletions
    const remainingCustomRoles = await db.role.findMany({
      where: { projectId, isDefault: false },
      select: { id: true, name: true },
    })
    const remainingCustomRoleNames = new Set(remainingCustomRoles.map((r) => r.name))

    // Create or update system default custom roles
    for (const customRole of defaultCustomRoles) {
      if (remainingCustomRoleNames.has(customRole.name)) {
        // Update existing custom role to match system defaults
        await db.role.updateMany({
          where: { projectId, name: customRole.name, isDefault: false },
          data: {
            permissions: customRole.permissions.filter(isValidPermission),
            color: customRole.color,
            description: customRole.description,
            position: customRole.position,
          },
        })
      } else {
        // Create the custom role from system defaults
        await db.role.create({
          data: {
            name: customRole.name,
            color: customRole.color,
            description: customRole.description,
            permissions: customRole.permissions.filter(isValidPermission),
            isDefault: false,
            position: customRole.position,
            projectId,
          },
        })
      }
    }

    // Fetch all roles to return
    const roles = await db.role.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        permissions: true,
        isDefault: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { position: 'asc' },
    })

    const rolesWithPermissions = roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      description: role.description,
      permissions: parsePermissions(role.permissions),
      isDefault: role.isDefault,
      position: role.position,
      memberCount: role._count.members,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }))

    // Emit SSE event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitRoleEvent({
      type: 'role.updated',
      projectId,
      roleId: 'all',
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(rolesWithPermissions)
  } catch (error) {
    return handleApiError(error, 'reset roles to defaults')
  }
}
