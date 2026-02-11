'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, RotateCcw, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getTabId } from '@/hooks/use-realtime'
import {
  ALL_PERMISSIONS,
  getSortedCategoriesWithPermissions,
  type Permission,
} from '@/lib/permissions/constants'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'

interface RolePermissionsData {
  rolePermissions: Record<DefaultRoleName, Permission[]>
  availablePermissions: Permission[]
  roleNames: DefaultRoleName[]
}

const ROLE_ORDER: DefaultRoleName[] = ['Owner', 'Admin', 'Member']

export function RolePermissionsForm() {
  const queryClient = useQueryClient()
  const [localPermissions, setLocalPermissions] = useState<Record<string, Permission[]>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isAtDefaults, setIsAtDefaults] = useState(true)

  const { data, isLoading, error } = useQuery<RolePermissionsData>({
    queryKey: ['admin', 'settings', 'roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings/roles')
      if (!res.ok) throw new Error('Failed to fetch role permissions')
      return res.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (permissions: Record<string, Permission[]>) => {
      const res = await fetch('/api/admin/settings/roles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(permissions),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update role permissions')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'roles'] })
      toast.success('Role permissions saved')
      setHasChanges(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings/roles', {
        method: 'POST',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) throw new Error('Failed to reset role permissions')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'roles'] })
      toast.success('Role permissions reset to defaults')
      setHasChanges(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reset')
    },
  })

  // Sync local state when data loads
  useEffect(() => {
    if (data?.rolePermissions) {
      setLocalPermissions(data.rolePermissions)
    }
  }, [data])

  // Check for changes from saved state
  useEffect(() => {
    if (data?.rolePermissions) {
      const changed = Object.keys(localPermissions).some((role) => {
        const original = data.rolePermissions[role as DefaultRoleName] || []
        const current = localPermissions[role] || []
        return original.length !== current.length || !original.every((p) => current.includes(p))
      })
      setHasChanges(changed)
    }
  }, [localPermissions, data])

  // Check if current permissions match defaults
  useEffect(() => {
    const matchesDefaults = ROLE_ORDER.every((role) => {
      const current = localPermissions[role] || []
      const defaults = ROLE_PRESETS[role] || []
      return current.length === defaults.length && defaults.every((p) => current.includes(p))
    })
    setIsAtDefaults(matchesDefaults)
  }, [localPermissions])

  // Compute column toggle states for Admin and Member
  const columnToggleState = useMemo(() => {
    const states: Record<string, 'checked' | 'indeterminate' | 'unchecked'> = {}
    for (const role of ROLE_ORDER) {
      if (role === 'Owner') continue
      const perms = localPermissions[role] || []
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
  }, [localPermissions])

  const togglePermission = (role: DefaultRoleName, permission: Permission) => {
    // Owner always has all permissions
    if (role === 'Owner') return

    setLocalPermissions((prev) => {
      const current = prev[role] || []
      const hasPermission = current.includes(permission)
      return {
        ...prev,
        [role]: hasPermission ? current.filter((p) => p !== permission) : [...current, permission],
      }
    })
  }

  const toggleAllForRole = (role: DefaultRoleName) => {
    if (role === 'Owner') return

    setLocalPermissions((prev) => {
      const current = prev[role] || []
      const allEnabled =
        current.length === ALL_PERMISSIONS.length &&
        ALL_PERMISSIONS.every((p) => current.includes(p))
      return {
        ...prev,
        [role]: allEnabled ? [] : [...ALL_PERMISSIONS],
      }
    })
  }

  const handleSave = () => {
    updateMutation.mutate(localPermissions)
  }

  const handleReset = () => {
    resetMutation.mutate()
  }

  const handleCancel = () => {
    if (data?.rolePermissions) {
      setLocalPermissions(data.rolePermissions)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="py-6">
          <p className="text-red-400">Failed to load role permissions</p>
        </CardContent>
      </Card>
    )
  }

  const categorizedPermissions = getSortedCategoriesWithPermissions()

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Default Roles</CardTitle>
          <CardDescription className="text-zinc-400 mt-1">
            Configure which permissions each role has when new projects are created. These settings
            apply to new projects only.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                        checked={toggleState === 'checked'}
                        data-state={toggleState}
                        onCheckedChange={() => toggleAllForRole(role)}
                        className={
                          toggleState === 'indeterminate'
                            ? 'border-zinc-600 bg-zinc-600 data-[state=indeterminate]:bg-zinc-600'
                            : 'border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600'
                        }
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
                        const rolePerms = localPermissions[role] || []
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
        </CardContent>
      </Card>

      {/* Info Note */}
      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">Note about existing projects</p>
              <p>
                Changes here only affect newly created projects. Existing projects retain their
                current role configurations. Project owners can customize roles within their own
                projects at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky footer for unsaved changes */}
      {hasChanges && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-b-lg">
          <p className="text-sm text-zinc-400">You have unsaved changes</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isAtDefaults || resetMutation.isPending}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span className="ml-2">Reset to Defaults</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
