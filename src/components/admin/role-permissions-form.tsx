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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RoleCompareDialog } from '@/components/projects/permissions/role-compare-dialog'
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
import { LABEL_COLORS } from '@/lib/constants'
import type { Permission } from '@/lib/permissions/constants'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'
import type { RoleWithPermissions } from '@/types'

interface RoleConfig {
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

interface CustomRole {
  id: string
  name: string
  permissions: Permission[]
  color: string
  description: string
  position: number
}

type RoleSettings = Record<DefaultRoleName, RoleConfig>

interface RoleSettingsData {
  roleSettings: RoleSettings
  customRoles: CustomRole[]
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

let nextCustomId = 1

export function RolePermissionsForm() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<RoleSettings>(getDefaultSettings())
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [isAtDefaults, setIsAtDefaults] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('Owner')
  const [isCreating, setIsCreating] = useState(false)
  const [roleOrder, setRoleOrder] = useState<DefaultRoleName[]>(['Owner', 'Admin', 'Member'])
  const [showDiff, setShowDiff] = useState(false)
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  // Form state for creating new roles
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0])
  const [editDescription, setEditDescription] = useState('')
  const [editPermissions, setEditPermissions] = useState<Permission[]>([])

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
    mutationFn: async (payload: { settings: RoleSettings; customRoles: CustomRole[] }) => {
      const res = await fetch('/api/admin/settings/roles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ ...payload.settings, customRoles: payload.customRoles }),
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
      setIsCreating(false)
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
      setCustomRoles([])
      setIsCreating(false)
      setSelectedId('Owner')
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
    if (data?.customRoles) {
      setCustomRoles(data.customRoles)
    }
  }, [data])

  // Check for changes from saved state
  useEffect(() => {
    if (data?.roleSettings) {
      const defaultsChanged = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).some((role) => {
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
      const savedCustom = data.customRoles ?? []
      const customChanged =
        customRoles.length !== savedCustom.length ||
        JSON.stringify(customRoles) !== JSON.stringify(savedCustom)
      setHasChanges(defaultsChanged || customChanged || isCreating)
    }
  }, [localSettings, customRoles, data, isCreating])

  // Check if current settings match hard-coded defaults
  useEffect(() => {
    const defaults = getDefaultSettings()
    const matchesDefaults =
      customRoles.length === 0 &&
      (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).every((role) => {
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
  }, [localSettings, customRoles])

  // Determine if selected role is a built-in default
  const isBuiltInRole = ['Owner', 'Admin', 'Member'].includes(selectedId)
  const selectedCustomRole = customRoles.find((r) => r.id === selectedId)

  // Get current config for the selected role
  const selectedConfig = isBuiltInRole
    ? localSettings[selectedId as DefaultRoleName]
    : selectedCustomRole

  // Check if the selected role's permissions match its preset defaults
  const selectedRoleAtDefaults = useMemo(() => {
    if (!isBuiltInRole) return true
    const current = localSettings[selectedId as DefaultRoleName]
    const defaults = ROLE_PRESETS[selectedId as DefaultRoleName]
    return (
      current.permissions.length === defaults.length &&
      defaults.every((p) => current.permissions.includes(p))
    )
  }, [localSettings, selectedId, isBuiltInRole])

  // Get original permissions for the selected role (from saved server state)
  const originalPermissions = useMemo(() => {
    if (isCreating) return undefined
    if (isBuiltInRole) {
      return data?.roleSettings?.[selectedId as DefaultRoleName]?.permissions
    }
    return data?.customRoles?.find((r) => r.id === selectedId)?.permissions
  }, [data, selectedId, isBuiltInRole, isCreating])

  // Check if the selected role has unsaved changes
  const selectedRoleHasChanges = useMemo(() => {
    if (isCreating) return false
    if (isBuiltInRole) {
      if (!data?.roleSettings) return false
      const original = data.roleSettings[selectedId as DefaultRoleName]
      const current = localSettings[selectedId as DefaultRoleName]
      if (!original || !current) return false
      return (
        original.name !== current.name ||
        original.color !== current.color ||
        original.description !== current.description ||
        original.position !== current.position ||
        original.permissions.length !== current.permissions.length ||
        !original.permissions.every((p) => current.permissions.includes(p))
      )
    }
    // Custom role
    const saved = data?.customRoles?.find((r) => r.id === selectedId)
    if (!saved || !selectedCustomRole) return false
    return JSON.stringify(saved) !== JSON.stringify(selectedCustomRole)
  }, [data, selectedId, localSettings, isBuiltInRole, selectedCustomRole, isCreating])

  // Get preset permissions for the selected built-in role
  const presetPermissions = isBuiltInRole ? ROLE_PRESETS[selectedId as DefaultRoleName] : undefined

  const handleCloneRole = useCallback(
    (roleId: string) => {
      const isDefault = ['Owner', 'Admin', 'Member'].includes(roleId)
      const source = isDefault
        ? localSettings[roleId as DefaultRoleName]
        : customRoles.find((r) => r.id === roleId)
      if (!source) return

      const id = `custom-${Date.now()}-${nextCustomId++}`
      const maxPos = Math.max(
        ...Object.values(localSettings).map((r) => r.position),
        ...customRoles.map((r) => r.position),
        -1,
      )
      const newRole: CustomRole = {
        id,
        name: `${source.name} (Copy)`,
        permissions: [...source.permissions],
        color: source.color,
        description: source.description,
        position: maxPos + 1,
      }
      setCustomRoles((prev) => [...prev, newRole])
      setSelectedId(id)
      setIsCreating(false)
      toast.success(`Cloned "${source.name}"`)
    },
    [localSettings, customRoles],
  )

  const handleDeleteCustomRole = useCallback(
    (roleId: string) => {
      if (['Owner', 'Admin', 'Member'].includes(roleId)) return
      const role = customRoles.find((r) => r.id === roleId)
      setCustomRoles((prev) => prev.filter((r) => r.id !== roleId))
      if (selectedId === roleId) {
        setSelectedId('Owner')
      }
      if (role) toast.success(`Removed "${role.name}"`)
    },
    [customRoles, selectedId],
  )

  // Build actions for each role item
  const getRoleActions = useCallback(
    (roleId: string, isDefault: boolean): RoleItemAction[] => {
      const actions: RoleItemAction[] = [
        {
          icon: Copy,
          label: 'Clone',
          onClick: () => handleCloneRole(roleId),
        },
      ]
      actions.push({
        icon: Trash2,
        label: 'Delete',
        onClick: () => handleDeleteCustomRole(roleId),
        disabled: isDefault,
        variant: 'destructive' as const,
      })
      return actions
    },
    [handleCloneRole, handleDeleteCustomRole],
  )

  const handleFieldChange = (field: string, value: string | Permission[]) => {
    if (isCreating) {
      switch (field) {
        case 'name':
          setEditName(value as string)
          break
        case 'color':
          setEditColor(value as string)
          break
        case 'description':
          setEditDescription(value as string)
          break
        case 'permissions':
          setEditPermissions(value as Permission[])
          break
      }
      return
    }

    if (isBuiltInRole) {
      setLocalSettings((prev) => ({
        ...prev,
        [selectedId]: { ...prev[selectedId as DefaultRoleName], [field]: value },
      }))
    } else {
      setCustomRoles((prev) =>
        prev.map((r) => (r.id === selectedId ? { ...r, [field]: value } : r)),
      )
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const allIds = [...roleOrder, ...customRoles.map((r) => r.id)]
    const oldIndex = allIds.indexOf(active.id as string)
    const newIndex = allIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newAllIds = [...allIds]
    const [moved] = newAllIds.splice(oldIndex, 1)
    newAllIds.splice(newIndex, 0, moved)

    // Split back into default order + custom roles
    const newDefaultOrder = newAllIds.filter((id) =>
      ['Owner', 'Admin', 'Member'].includes(id),
    ) as DefaultRoleName[]
    setRoleOrder(newDefaultOrder)

    // Update positions for all
    setLocalSettings((prev) => {
      const updated = { ...prev }
      for (const id of newDefaultOrder) {
        updated[id] = { ...updated[id], position: newAllIds.indexOf(id) }
      }
      return updated
    })
    setCustomRoles((prev) => prev.map((r) => ({ ...r, position: newAllIds.indexOf(r.id) })))
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedId('')
    setEditName('')
    setEditColor(LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)])
    setEditDescription('')
    setEditPermissions([])
  }

  const handleCreateRole = () => {
    if (!editName.trim()) {
      toast.error('Role name is required')
      return
    }
    const id = `custom-${Date.now()}-${nextCustomId++}`
    const maxPos = Math.max(
      ...Object.values(localSettings).map((r) => r.position),
      ...customRoles.map((r) => r.position),
      -1,
    )
    const newRole: CustomRole = {
      id,
      name: editName.trim(),
      permissions: editPermissions,
      color: editColor,
      description: editDescription.trim(),
      position: maxPos + 1,
    }
    setCustomRoles((prev) => [...prev, newRole])
    setIsCreating(false)
    setSelectedId(id)
  }

  const handleSave = () => {
    if (isCreating) {
      handleCreateRole()
    }
    updateMutation.mutate({ settings: localSettings, customRoles })
  }

  const handleReset = () => {
    resetMutation.mutate()
  }

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false)
      setSelectedId('Owner')
    }
    if (data?.roleSettings) {
      setLocalSettings(data.roleSettings)
      const sorted = (['Owner', 'Admin', 'Member'] as DefaultRoleName[]).sort(
        (a, b) => (data.roleSettings[a]?.position ?? 0) - (data.roleSettings[b]?.position ?? 0),
      )
      setRoleOrder(sorted)
    }
    if (data?.customRoles) {
      setCustomRoles(data.customRoles)
    } else {
      setCustomRoles([])
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

  // All role IDs for DnD
  const allRoleIds = [...roleOrder, ...customRoles.map((r) => r.id)]

  // Map all roles to EditorRole for the shared SortableRoleItem
  const editorRoles: EditorRole[] = [
    ...roleOrder.map((role) => ({
      id: role,
      name: localSettings[role].name,
      color: localSettings[role].color,
      description: localSettings[role].description,
      isDefault: true,
    })),
    ...customRoles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      description: r.description,
      isDefault: false,
    })),
  ]

  // Map all roles to RoleWithPermissions for the compare dialog
  const compareRoles: RoleWithPermissions[] = [
    ...roleOrder.map((role) => ({
      id: role,
      name: localSettings[role].name,
      color: localSettings[role].color,
      description: localSettings[role].description,
      isDefault: true,
      position: localSettings[role].position,
      permissions: localSettings[role].permissions,
    })),
    ...customRoles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      description: r.description,
      isDefault: false,
      position: r.position,
      permissions: r.permissions,
    })),
  ]

  // Editor config: either built-in, custom, or creating
  const editorName = isCreating ? editName : (selectedConfig?.name ?? '')
  const editorColor = isCreating ? editColor : (selectedConfig?.color ?? LABEL_COLORS[0])
  const editorDescription = isCreating ? editDescription : (selectedConfig?.description ?? '')
  const editorPermissions = isCreating ? editPermissions : (selectedConfig?.permissions ?? [])

  return (
    <div className="flex gap-6 h-full min-h-[500px]">
      {/* Left Panel - Role List */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
          <div className="flex items-center gap-1">
            {compareRoles.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompareDialog(true)}
                title="Compare Roles"
              >
                <GitCompare className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleStartCreate}>
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
            <SortableContext items={allRoleIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 pr-3">
                {editorRoles.map((role) => (
                  <SortableRoleItem
                    key={role.id}
                    role={role}
                    isSelected={selectedId === role.id && !isCreating}
                    isCreating={isCreating}
                    canReorder
                    onSelect={() => {
                      setSelectedId(role.id)
                      setIsCreating(false)
                    }}
                    actions={getRoleActions(role.id, role.isDefault)}
                  />
                ))}

                {isCreating && (
                  <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-amber-900/20 border border-amber-700/50">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <span className="text-sm font-medium text-amber-400">
                      {editName || 'New Role'}
                    </span>
                  </div>
                )}
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
          name={editorName}
          color={editorColor}
          description={editorDescription}
          permissions={editorPermissions}
          onNameChange={(name) => handleFieldChange('name', name)}
          onColorChange={(color) => handleFieldChange('color', color)}
          onDescriptionChange={(description) => handleFieldChange('description', description)}
          onPermissionsChange={(permissions) => handleFieldChange('permissions', permissions)}
          isDefault={isBuiltInRole && !isCreating}
          isOwnerRole={selectedId === 'Owner' && !isCreating}
          isCreating={isCreating}
          headerDescription={
            isCreating ? 'Create a new default role for new projects.' : editorDescription
          }
          presetPermissions={presetPermissions}
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
                    {isCreating ? 'Create & Save' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Compare roles dialog */}
      {compareRoles.length >= 2 && (
        <RoleCompareDialog
          open={showCompareDialog}
          onOpenChange={setShowCompareDialog}
          roles={compareRoles}
        />
      )}
    </div>
  )
}
