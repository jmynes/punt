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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Loader2, Lock, Palette, Pencil, RotateCcw, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PermissionGrid } from '@/components/projects/permissions/permission-grid'
import { ColorPickerBody } from '@/components/tickets/label-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getTabId } from '@/hooks/use-realtime'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions/constants'
import {
  type DefaultRoleName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from '@/lib/permissions/presets'
import { cn } from '@/lib/utils'

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

interface SortableRoleItemProps {
  role: DefaultRoleName
  config: RoleConfig
  isSelected: boolean
  onSelect: () => void
}

function SortableRoleItem({ role, config, isSelected, onSelect }: SortableRoleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-md transition-colors',
        isDragging && 'z-50 bg-zinc-700 shadow-lg ring-1 ring-amber-500/50',
        isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
      )}
    >
      <button
        type="button"
        className="ml-1 cursor-grab touch-none text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex-1 flex items-center gap-3 px-3 py-2.5 text-left transition-colors min-w-0',
          isSelected ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{config.name}</span>
            <Lock className="h-3 w-3 text-zinc-600 flex-shrink-0" />
          </div>
          <p className="text-xs text-zinc-500 truncate">{config.description}</p>
        </div>
      </button>
    </div>
  )
}

export function RolePermissionsForm() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<RoleSettings>(getDefaultSettings())
  const [hasChanges, setHasChanges] = useState(false)
  const [isAtDefaults, setIsAtDefaults] = useState(true)
  const [selectedRole, setSelectedRole] = useState<DefaultRoleName>('Owner')
  const [roleOrder, setRoleOrder] = useState<DefaultRoleName[]>(['Owner', 'Admin', 'Member'])

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
      // Sort by position
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

  const allPermissionsEnabled = useMemo(() => {
    const current = localSettings[selectedRole]?.permissions || []
    return (
      current.length === ALL_PERMISSIONS.length && ALL_PERMISSIONS.every((p) => current.includes(p))
    )
  }, [localSettings, selectedRole])

  const handleNameChange = (name: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], name },
    }))
  }

  const handlePermissionsChange = (permissions: Permission[]) => {
    setLocalSettings((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], permissions },
    }))
  }

  const handleColorChange = (color: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], color },
    }))
  }

  const handleDescriptionChange = (description: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], description },
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

    // Update positions
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

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Default Roles</CardTitle>
          <CardDescription className="text-zinc-400 mt-1">
            Configure the default roles for new projects. Drag to reorder. These settings apply to
            new projects only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 min-h-[500px]">
            {/* Left Panel - Role List */}
            <div className="w-56 flex-shrink-0 flex flex-col">
              <div className="flex items-center mb-3">
                <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
              </div>
              <DndContext
                id="admin-roles-dnd"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={roleOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {roleOrder.map((role) => (
                      <SortableRoleItem
                        key={role}
                        role={role}
                        config={localSettings[role]}
                        isSelected={selectedRole === role}
                        onSelect={() => setSelectedRole(role)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Right Panel - Role Editor */}
            <div className="flex-1 min-w-0 flex flex-col">
              <Tabs defaultValue="appearance" className="h-full flex flex-col">
                <div className="mb-4">
                  <TabsList className="w-full grid grid-cols-2 h-auto p-0 bg-transparent rounded-none gap-0">
                    <TabsTrigger
                      value="appearance"
                      className="!rounded-none !rounded-l-lg !border !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Appearance
                    </TabsTrigger>
                    <TabsTrigger
                      value="permissions"
                      className="!rounded-none !rounded-r-lg !border !border-l-0 !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Permissions
                    </TabsTrigger>
                  </TabsList>
                </div>

                <Card className="flex-1 flex flex-col bg-zinc-900/50 border-zinc-800 min-h-0">
                  <CardHeader className="flex-shrink-0 pb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedConfig.color }}
                      />
                      <div className="group/title relative flex items-center gap-2 flex-1 min-w-0">
                        <div className="relative">
                          <Input
                            value={selectedConfig.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Role name..."
                            className="!text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 cursor-text"
                          />
                          <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700 group-hover/title:bg-zinc-500 group-focus-within/title:bg-amber-500 transition-colors" />
                        </div>
                        <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover/title:text-zinc-400 group-focus-within/title:text-amber-500 transition-colors flex-shrink-0" />
                      </div>
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                        <Lock className="mr-1 h-3 w-3" />
                        Default
                      </Badge>
                    </div>
                    <CardDescription>{selectedConfig.description}</CardDescription>
                  </CardHeader>

                  <TabsContent value="appearance" className="flex-1 min-h-0 mt-0">
                    <ScrollArea className="h-full">
                      <CardContent className="pt-0 space-y-4">
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <ColorPickerBody
                            activeColor={selectedConfig.color}
                            onColorChange={handleColorChange}
                            onApply={(color) => {
                              if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                                handleColorChange(color)
                              }
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="role-description">Description</Label>
                          <Textarea
                            id="role-description"
                            value={selectedConfig.description}
                            onChange={(e) => handleDescriptionChange(e.target.value)}
                            placeholder="Describe what this role can do..."
                            className="bg-zinc-800/50 resize-none border-zinc-700 hover:border-zinc-500"
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="permissions" className="flex-1 min-h-0 mt-0">
                    <ScrollArea className="h-full">
                      <CardContent className="pt-0 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Permissions</Label>
                            <div className="flex items-center gap-2">
                              {!isOwner && !selectedRoleAtDefaults && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handlePermissionsChange([...ROLE_PRESETS[selectedRole]])
                                  }
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
                                    handlePermissionsChange(
                                      allPermissionsEnabled ? [] : [...ALL_PERMISSIONS],
                                    )
                                  }
                                  className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  {allPermissionsEnabled ? 'Disable All' : 'Enable All'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isOwner && (
                            <p className="text-xs text-zinc-500">
                              Owner always has all permissions.
                            </p>
                          )}
                          <PermissionGrid
                            selectedPermissions={selectedConfig.permissions}
                            onChange={handlePermissionsChange}
                            disabled={isOwner}
                          />
                        </div>
                      </CardContent>
                    </ScrollArea>
                  </TabsContent>
                </Card>
              </Tabs>
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
