import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { ALL_PERMISSIONS, isValidPermission, type Permission } from '@/lib/permissions/constants'
import {
  DEFAULT_ROLE_NAMES,
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'

/** Full role config stored in DB */
interface RoleConfig {
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

export type DefaultRoleSettings = Record<DefaultRoleName, RoleConfig>

/** Get default role settings, reading from DB or falling back to hardcoded defaults */
function getDefaultSettings(): DefaultRoleSettings {
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

/** Parse stored JSON, handling both old format (arrays) and new format (objects) */
function parseStoredSettings(json: string): DefaultRoleSettings {
  const defaults = getDefaultSettings()
  try {
    const parsed = JSON.parse(json)

    for (const role of Object.values(DEFAULT_ROLE_NAMES)) {
      const value = parsed[role]
      if (!value) continue

      if (Array.isArray(value)) {
        // Old format: { "Owner": ["perm1", "perm2"] }
        defaults[role].permissions = value.filter(isValidPermission)
      } else if (typeof value === 'object') {
        // New format: { "Owner": { permissions: [...], color: "...", ... } }
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
        if (typeof value.name === 'string' && value.name.trim()) {
          defaults[role].name = value.name.trim()
        }
      }
    }
  } catch {
    // Return defaults on parse error
  }
  return defaults
}

// Schema for updating role settings
const roleConfigSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: z.array(z.string()).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  position: z.number().optional(),
})

const updateRoleSettingsSchema = z.object({
  Owner: roleConfigSchema.optional(),
  Admin: roleConfigSchema.optional(),
  Member: roleConfigSchema.optional(),
})

/**
 * GET /api/admin/settings/roles - Get default role settings
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const settings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    const roleSettings = settings?.defaultRolePermissions
      ? parseStoredSettings(settings.defaultRolePermissions)
      : getDefaultSettings()

    // Owner always has all permissions
    roleSettings.Owner.permissions = [...ALL_PERMISSIONS]

    return NextResponse.json({
      roleSettings,
      availablePermissions: ALL_PERMISSIONS,
      roleNames: Object.values(DEFAULT_ROLE_NAMES),
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to get role settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/settings/roles - Update default role settings
 */
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireSystemAdmin()
    const tabId = request.headers.get('X-Tab-Id') || undefined

    const body = await request.json()
    const parsed = updateRoleSettingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Get current settings
    const currentDbSettings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    const currentSettings = currentDbSettings?.defaultRolePermissions
      ? parseStoredSettings(currentDbSettings.defaultRolePermissions)
      : getDefaultSettings()

    // Merge updates
    const updates = parsed.data
    for (const role of Object.values(DEFAULT_ROLE_NAMES)) {
      const update = updates[role]
      if (!update) continue

      if (update.name !== undefined) {
        currentSettings[role].name = update.name.trim()
      }
      if (update.permissions) {
        currentSettings[role].permissions = update.permissions.filter(isValidPermission)
      }
      if (update.color !== undefined) {
        currentSettings[role].color = update.color
      }
      if (update.description !== undefined) {
        currentSettings[role].description = update.description
      }
      if (update.position !== undefined) {
        currentSettings[role].position = update.position
      }
    }

    // Owner must always have all permissions
    currentSettings.Owner.permissions = [...ALL_PERMISSIONS]

    // Save to database
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      create: {
        id: 'system-settings',
        defaultRolePermissions: JSON.stringify(currentSettings),
      },
      update: {
        defaultRolePermissions: JSON.stringify(currentSettings),
      },
    })

    // Emit SSE event for real-time updates
    projectEvents.emitSettingsEvent({
      type: 'settings.roles.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      roleSettings: currentSettings,
      message: 'Default role settings updated successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update role settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/settings/roles - Reset to default presets
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireSystemAdmin()
    const tabId = request.headers.get('X-Tab-Id') || undefined

    const defaults = getDefaultSettings()

    // Reset to default presets
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      create: {
        id: 'system-settings',
        defaultRolePermissions: JSON.stringify(defaults),
      },
      update: {
        defaultRolePermissions: JSON.stringify(defaults),
      },
    })

    // Emit SSE event for real-time updates
    projectEvents.emitSettingsEvent({
      type: 'settings.roles.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      roleSettings: defaults,
      message: 'Role settings reset to defaults',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to reset role settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
