'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RotateCcw, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DefaultRolesPermissionGrid } from '@/components/projects/permissions/default-roles-permission-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getTabId } from '@/hooks/use-realtime'
import type { Permission } from '@/lib/permissions/constants'
import { type DefaultRoleName, ROLE_PRESETS } from '@/lib/permissions/presets'

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
          <DefaultRolesPermissionGrid
            rolePermissions={localPermissions}
            onPermissionsChange={setLocalPermissions}
          />
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
