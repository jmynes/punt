'use client'

import { Check, Shield } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  ALL_PERMISSIONS,
  getSortedCategoriesWithPermissions,
  type Permission,
} from '@/lib/permissions/constants'
import { type DefaultRoleName, ROLE_COLORS, ROLE_DESCRIPTIONS } from '@/lib/permissions/presets'

const ROLE_ORDER: DefaultRoleName[] = ['Owner', 'Admin', 'Member']

interface DefaultRolesPermissionGridProps {
  /** Current permissions for each role */
  rolePermissions: Record<string, Permission[]>
  /** Callback when permissions change */
  onPermissionsChange: (rolePermissions: Record<string, Permission[]>) => void
  /** Whether editing is disabled */
  disabled?: boolean
}

/**
 * A permission matrix grid showing roles as columns and permissions as rows.
 * Used for editing default role permissions in admin settings.
 *
 * Features:
 * - Owner column shows checkmarks for all permissions (uneditable)
 * - Admin and Member columns have checkboxes
 * - Column header has "All" toggle for selecting/deselecting all permissions
 * - Permissions are grouped by category
 */
export function DefaultRolesPermissionGrid({
  rolePermissions,
  onPermissionsChange,
  disabled = false,
}: DefaultRolesPermissionGridProps) {
  const categorizedPermissions = useMemo(() => getSortedCategoriesWithPermissions(), [])

  // Compute column toggle states for Admin and Member
  const columnToggleState = useMemo(() => {
    const states: Record<string, 'checked' | 'indeterminate' | 'unchecked'> = {}
    for (const role of ROLE_ORDER) {
      if (role === 'Owner') continue
      const perms = rolePermissions[role] || []
      const count = perms.length
      if (count === ALL_PERMISSIONS.length && ALL_PERMISSIONS.every((p) => perms.includes(p))) {
        states[role] = 'checked'
      } else if (count > 0) {
        states[role] = 'indeterminate'
      } else {
        states[role] = 'unchecked'
      }
    }
    return states
  }, [rolePermissions])

  const togglePermission = (role: DefaultRoleName, permission: Permission) => {
    // Owner always has all permissions
    if (role === 'Owner' || disabled) return

    const current = rolePermissions[role] || []
    const hasPermission = current.includes(permission)
    const newPermissions = hasPermission
      ? current.filter((p) => p !== permission)
      : [...current, permission]

    onPermissionsChange({
      ...rolePermissions,
      [role]: newPermissions,
    })
  }

  const toggleAllForRole = (role: DefaultRoleName) => {
    if (role === 'Owner' || disabled) return

    const current = rolePermissions[role] || []
    const allEnabled =
      current.length === ALL_PERMISSIONS.length && ALL_PERMISSIONS.every((p) => current.includes(p))

    onPermissionsChange({
      ...rolePermissions,
      [role]: allEnabled ? [] : [...ALL_PERMISSIONS],
    })
  }

  return (
    <div>
      {/* Role Headers */}
      <div className="grid grid-cols-[280px_repeat(3,1fr)] gap-4 mb-4 pb-3 border-b border-zinc-800">
        <div className="text-sm font-medium text-zinc-400">Permission</div>
        {ROLE_ORDER.map((role) => {
          const isOwner = role === 'Owner'
          const toggleState = columnToggleState[role]
          return (
            <div key={role} className="text-center">
              <Badge
                variant="outline"
                className="font-medium"
                style={{
                  borderColor: `${ROLE_COLORS[role]}50`,
                  color: ROLE_COLORS[role],
                }}
              >
                {isOwner && <Shield className="h-3 w-3 mr-1" />}
                {role}
              </Badge>
              <p className="text-xs text-zinc-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
              {!isOwner && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Checkbox
                    checked={
                      toggleState === 'checked'
                        ? true
                        : toggleState === 'indeterminate'
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={() => toggleAllForRole(role)}
                    disabled={disabled}
                    className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 data-[state=indeterminate]:bg-zinc-600"
                  />
                  <span className="text-xs text-zinc-500">All</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Permission Categories */}
      <div className="space-y-6">
        {categorizedPermissions.map(({ category, permissions }) => (
          <div key={category.key}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-zinc-300">{category.label}</h3>
              <span className="text-xs text-zinc-500">{category.description}</span>
            </div>
            <div className="space-y-2">
              {permissions.map((perm) => (
                <div
                  key={perm.key}
                  className="grid grid-cols-[280px_repeat(3,1fr)] gap-4 py-2 px-3 rounded-lg hover:bg-zinc-800/50"
                >
                  <div>
                    <Label className="text-sm text-zinc-200">{perm.label}</Label>
                    <p className="text-xs text-zinc-500">{perm.description}</p>
                  </div>
                  {ROLE_ORDER.map((role) => {
                    const rolePerms = rolePermissions[role] || []
                    const hasPermission = rolePerms.includes(perm.key)
                    const isOwner = role === 'Owner'

                    return (
                      <div key={role} className="flex justify-center items-center">
                        {isOwner ? (
                          <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/20">
                            <Check className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                        ) : (
                          <Checkbox
                            checked={hasPermission}
                            onCheckedChange={() => togglePermission(role, perm.key)}
                            disabled={disabled}
                            className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
