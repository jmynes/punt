import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ALL_PERMISSIONS, isValidPermission, type Permission } from '@/lib/permissions/constants'
import { DEFAULT_ROLE_NAMES, type DefaultRoleName, ROLE_PRESETS } from '@/lib/permissions/presets'

// Schema for updating role permissions
const updateRolePermissionsSchema = z.object({
  Owner: z.array(z.string()).optional(),
  Admin: z.array(z.string()).optional(),
  Member: z.array(z.string()).optional(),
  Viewer: z.array(z.string()).optional(),
})

export type DefaultRolePermissions = {
  [K in DefaultRoleName]: Permission[]
}

/**
 * GET /api/admin/settings/roles - Get default role permissions
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const settings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    // Parse stored permissions or use presets as defaults
    let rolePermissions: DefaultRolePermissions
    if (settings?.defaultRolePermissions) {
      try {
        const parsed = JSON.parse(settings.defaultRolePermissions)
        rolePermissions = {
          Owner: (parsed.Owner || ROLE_PRESETS.Owner).filter(isValidPermission),
          Admin: (parsed.Admin || ROLE_PRESETS.Admin).filter(isValidPermission),
          Member: (parsed.Member || ROLE_PRESETS.Member).filter(isValidPermission),
          Viewer: (parsed.Viewer || ROLE_PRESETS.Viewer).filter(isValidPermission),
        }
      } catch {
        // Fall back to presets if parsing fails
        rolePermissions = { ...ROLE_PRESETS }
      }
    } else {
      rolePermissions = { ...ROLE_PRESETS }
    }

    return NextResponse.json({
      rolePermissions,
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
    console.error('Failed to get role permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/settings/roles - Update default role permissions
 */
export async function PATCH(request: Request) {
  try {
    await requireSystemAdmin()

    const body = await request.json()
    const parsed = updateRolePermissionsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Get current settings
    const currentSettings = await db.systemSettings.findUnique({
      where: { id: 'system-settings' },
      select: { defaultRolePermissions: true },
    })

    // Parse current permissions
    let currentPermissions: DefaultRolePermissions
    if (currentSettings?.defaultRolePermissions) {
      try {
        const current = JSON.parse(currentSettings.defaultRolePermissions)
        currentPermissions = {
          Owner: current.Owner || ROLE_PRESETS.Owner,
          Admin: current.Admin || ROLE_PRESETS.Admin,
          Member: current.Member || ROLE_PRESETS.Member,
          Viewer: current.Viewer || ROLE_PRESETS.Viewer,
        }
      } catch {
        currentPermissions = { ...ROLE_PRESETS }
      }
    } else {
      currentPermissions = { ...ROLE_PRESETS }
    }

    // Validate and merge updates
    const updates = parsed.data
    const newPermissions: DefaultRolePermissions = {
      Owner: updates.Owner ? updates.Owner.filter(isValidPermission) : currentPermissions.Owner,
      Admin: updates.Admin ? updates.Admin.filter(isValidPermission) : currentPermissions.Admin,
      Member: updates.Member ? updates.Member.filter(isValidPermission) : currentPermissions.Member,
      Viewer: updates.Viewer ? updates.Viewer.filter(isValidPermission) : currentPermissions.Viewer,
    }

    // Owner must always have all permissions
    newPermissions.Owner = [...ALL_PERMISSIONS]

    // Save to database
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      create: {
        id: 'system-settings',
        defaultRolePermissions: JSON.stringify(newPermissions),
      },
      update: {
        defaultRolePermissions: JSON.stringify(newPermissions),
      },
    })

    return NextResponse.json({
      rolePermissions: newPermissions,
      message: 'Default role permissions updated successfully',
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
    console.error('Failed to update role permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/settings/roles/reset - Reset to default presets
 */
export async function POST() {
  try {
    await requireSystemAdmin()

    // Reset to default presets
    await db.systemSettings.upsert({
      where: { id: 'system-settings' },
      create: {
        id: 'system-settings',
        defaultRolePermissions: JSON.stringify(ROLE_PRESETS),
      },
      update: {
        defaultRolePermissions: JSON.stringify(ROLE_PRESETS),
      },
    })

    return NextResponse.json({
      rolePermissions: ROLE_PRESETS,
      message: 'Role permissions reset to defaults',
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
    console.error('Failed to reset role permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
