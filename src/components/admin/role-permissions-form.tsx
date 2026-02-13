'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, RotateCcw, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PermissionGrid } from '@/components/projects/permissions/permission-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getTabId } from '@/hooks/use-realtime'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions/constants'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'
import { cn } from '@/lib/utils'

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
  const [selectedRole, setSelectedRole] = useState<DefaultRoleName>('Owner')

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

  // Check if the selected role's permissions match its preset defaults
  const selectedRoleAtDefaults = useMemo(() => {
    const current = localPermissions[selectedRole] || []
    const defaults = ROLE_PRESETS[selectedRole] || []
    return current.length === defaults.length && defaults.every((p) => current.includes(p))
  }, [localPermissions, selectedRole])

  // Check if all permissions are enabled for the selected role
  const allPermissionsEnabled = useMemo(() => {
    const current = localPermissions[selectedRole] || []
    return (
      current.length === ALL_PERMISSIONS.length && ALL_PERMISSIONS.every((p) => current.includes(p))
    )
  }, [localPermissions, selectedRole])

  const handlePermissionsChange = (permissions: Permission[]) => {
    setLocalPermissions((prev) => ({
      ...prev,
      [selectedRole]: permissions,
    }))
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

  const isOwner = selectedRole === 'Owner'

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
          <div className="flex gap-6 min-h-[400px]">
            {/* Left Panel - Role List */}
            <div className="w-56 flex-shrink-0 flex flex-col">
              <div className="flex items-center mb-3">
                <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
              </div>
              <div className="space-y-1">
                {ROLE_ORDER.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors',
                      selectedRole === role
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
                    )}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ROLE_COLORS[role] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{role}</span>
                        <Lock className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {ROLE_DESCRIPTIONS[role].length > 50
                          ? `${ROLE_DESCRIPTIONS[role].slice(0, 50)}...`
                          : ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Panel - Permission Editor */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="font-medium"
                    style={{
                      borderColor: `${ROLE_COLORS[selectedRole]}50`,
                      color: ROLE_COLORS[selectedRole],
                    }}
                  >
                    {selectedRole === 'Owner' && <Shield className="h-3 w-3 mr-1" />}
                    {selectedRole}
                  </Badge>
                  {isOwner && (
                    <span className="text-xs text-zinc-500">Owner always has all permissions</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isOwner && !selectedRoleAtDefaults && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePermissionsChange([...ROLE_PRESETS[selectedRole]])}
                      className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset to Defaults
                    </Button>
                  )}
                  {!isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handlePermissionsChange(allPermissionsEnabled ? [] : [...ALL_PERMISSIONS])
                      }
                      className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {allPermissionsEnabled ? 'Disable All' : 'Enable All'}
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <PermissionGrid
                  selectedPermissions={localPermissions[selectedRole] || []}
                  onChange={handlePermissionsChange}
                  disabled={isOwner}
                />
              </ScrollArea>
            </div>
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
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
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
