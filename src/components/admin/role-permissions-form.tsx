'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, GitCompare, Loader2, Plus, RotateCcw, Shield, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RoleEditorPanel } from '@/components/projects/permissions/role-editor-panel'
import {
  type EditorRole,
  type RoleItemAction,
  SortableRoleItem,
} from '@/components/projects/permissions/sortable-role-item'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getTabId } from '@/hooks/use-realtime'
import type { Permission } from '@/lib/permissions/constants'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'

interface RoleConfig {
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

type RoleSettings = Record<DefaultRoleName, RoleConfig>

interface RoleSettingsData {
  roleSettings: RoleSettings
  availablePermissions: Permission[]
  roleNames: DefaultRoleName[]
}

function getDefaultSettings(): RoleSettings {
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

export function RolePermissionsForm() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<RoleSettings>(getDefaultSettings())
  const [hasChanges, setHasChanges] = useState(false)
  const [isAtDefaults, setIsAtDefaults] = useState(true)
  const [selectedRole, setSelectedRole] = useState<DefaultRoleName>('Owner')
  const [roleOrder, setRoleOrder] = useState<DefaultRoleName[]>(['Owner', 'Admin', 'Member'])
  const [showDiff, setShowDiff] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data, isLoading, error } = useQuery<RoleSettingsData>({
    queryKey: ['admin', 'settings', 'roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings/roles')
      if (!res.ok) throw new Error('Failed to fetch role settings')
      return res.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (settings: RoleSettings) => {
      const res = await fetch('/api/admin/settings/roles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update role settings')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'roles'] })
      toast.success('Role settings saved')
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
        headers: { 'X-Tab-Id': getTabId() },
      })
      if (!res.ok) throw new Error('Failed to reset role settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'roles'] })
      toast.success('Role settings reset to defaults')
      setHasChanges(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reset')
    },
  })

  // Sync local state when data loads
  useEffect(() => {
    if (data?.roleSettings) {
      setLocalSettings(data.roleSettings)
      const sorted = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).sort(
        (a, b) => (data.roleSettings[a]?.position ?? 0) - (data.roleSettings[b]?.position ?? 0),
      )
      setRoleOrder(sorted)
    }
  }, [data])

  // Check for changes from saved state
  useEffect(() => {
    if (data?.roleSettings) {
      const changed = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).some((role) => {
        const original = data.roleSettings[role]
        const current = localSettings[role]
        if (!original || !current) return false
        return (
          original.name !== current.name ||
          original.color !== current.color ||
          original.description !== current.description ||
          original.position !== current.position ||
          original.permissions.length !== current.permissions.length ||
          !original.permissions.every((p) => current.permissions.includes(p))
        )
      })
      setHasChanges(changed)
    }
  }, [localSettings, data])

  // Check if current settings match defaults
  useEffect(() => {
    const defaults = getDefaultSettings()
    const matchesDefaults = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).every((role) => {
      const current = localSettings[role]
      const def = defaults[role]
      return (
        current.name === def.name &&
        current.color === def.color &&
        current.description === def.description &&
        current.position === def.position &&
        current.permissions.length === def.permissions.length &&
        def.permissions.every((p) => current.permissions.includes(p))
      )
    })
    setIsAtDefaults(matchesDefaults)
  }, [localSettings])

  // Check if the selected role's permissions match its preset defaults
  const selectedRoleAtDefaults = useMemo(() => {
    const current = localSettings[selectedRole]
    const defaults = ROLE_PRESETS[selectedRole]
    return (
      current.permissions.length === defaults.length &&
      defaults.every((p) => current.permissions.includes(p))
    )
  }, [localSettings, selectedRole])

  // Get original permissions for the selected role (from saved server state)
  const originalPermissions = useMemo(() => {
    if (!data?.roleSettings) return undefined
    return data.roleSettings[selectedRole]?.permissions
  }, [data, selectedRole])

  // Check if the selected role has unsaved changes
  const selectedRoleHasChanges = useMemo(() => {
    if (!data?.roleSettings) return false
    const original = data.roleSettings[selectedRole]
    const current = localSettings[selectedRole]
    if (!original || !current) return false
    return (
      original.name !== current.name ||
      original.color !== current.color ||
      original.description !== current.description ||
      original.position !== current.position ||
      original.permissions.length !== current.permissions.length ||
      !original.permissions.every((p) => current.permissions.includes(p))
    )
  }, [data, selectedRole, localSettings])

  // Build actions for each role item (disabled for default roles)
  const getRoleActions = (_role: DefaultRoleName): RoleItemAction[] => {
    return [
      {
        icon: Copy,
        label: 'Clone',
        onClick: () => {},
        disabled: true,
      },
      {
        icon: Trash2,
        label: 'Delete',
        onClick: () => {},
        disabled: true,
        variant: 'destructive' as const,
      },
    ]
  }

  const handleFieldChange = (field: string, value: string | Permission[]) => {
    setLocalSettings((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], [field]: value },
    }))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = roleOrder.indexOf(active.id as DefaultRoleName)
    const newIndex = roleOrder.indexOf(over.id as DefaultRoleName)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = [...roleOrder]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    setRoleOrder(newOrder)

    setLocalSettings((prev) => {
      const updated = { ...prev }
      for (let i = 0; i < newOrder.length; i++) {
        updated[newOrder[i]] = { ...updated[newOrder[i]], position: i }
      }
      return updated
    })
  }

  const handleSave = () => {
    updateMutation.mutate(localSettings)
  }

  const handleReset = () => {
    resetMutation.mutate()
  }

  const handleCancel = () => {
    if (data?.roleSettings) {
      setLocalSettings(data.roleSettings)
      const sorted = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).sort(
        (a, b) => (data.roleSettings[a]?.position ?? 0) - (data.roleSettings[b]?.position ?? 0),
      )
      setRoleOrder(sorted)
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
          <p className="text-red-400">Failed to load role settings</p>
        </CardContent>
      </Card>
    )
  }

  const isOwner = selectedRole === 'Owner'
  const selectedConfig = localSettings[selectedRole]

  // Map role configs to EditorRole for the shared SortableRoleItem
  const editorRoles: EditorRole[] = roleOrder.map((role) => ({
    id: role,
    name: localSettings[role].name,
    color: localSettings[role].color,
    description: localSettings[role].description,
    isDefault: true,
  }))

  return (
    <div className="flex gap-6 h-full min-h-[500px]">
      {/* Left Panel - Role List */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled title="Compare Roles">
              <GitCompare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled title="Cannot add custom default roles">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <DndContext
            id="admin-roles-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={roleOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 pr-3">
                {editorRoles.map((role) => (
                  <SortableRoleItem
                    key={role.id}
                    role={role}
                    isSelected={selectedRole === role.id}
                    canReorder
                    onSelect={() => setSelectedRole(role.id as DefaultRoleName)}
                    actions={getRoleActions(role.id as DefaultRoleName)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Info Note */}
          <div className="mt-6 pr-3">
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardContent className="py-3 px-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-500">
                    Changes here only affect newly created projects.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Role Editor */}
      <div className="flex-1 min-w-0">
        <RoleEditorPanel
          name={selectedConfig.name}
          color={selectedConfig.color}
          description={selectedConfig.description}
          permissions={selectedConfig.permissions}
          onNameChange={(name) => handleFieldChange('name', name)}
          onColorChange={(color) => handleFieldChange('color', color)}
          onDescriptionChange={(description) => handleFieldChange('description', description)}
          onPermissionsChange={(permissions) => handleFieldChange('permissions', permissions)}
          isDefault
          isOwnerRole={isOwner}
          headerDescription={selectedConfig.description}
          presetPermissions={ROLE_PRESETS[selectedRole]}
          isAtDefaults={selectedRoleAtDefaults}
          showDiff={showDiff}
          originalPermissions={originalPermissions}
          onShowDiffChange={setShowDiff}
          hasUnsavedChanges={selectedRoleHasChanges}
          footer={
            hasChanges ? (
              <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
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
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
