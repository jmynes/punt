'use client'

import {
  ArrowRightLeft,
  Copy,
  GitCompare,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  useAddMember,
  useAvailableUsers,
  useProjectMembers,
  useRemoveMember,
  useUpdateMember,
} from '@/hooks/queries/use-members'
import {
  useCreateRole,
  useDeleteRole,
  useProjectRoles,
  useUpdateRole,
} from '@/hooks/queries/use-roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import type { Permission, RoleWithPermissions } from '@/types'
import { PermissionGrid } from './permission-grid'
import { RoleCompareDialog } from './role-compare-dialog'

// Preset colors for role badges
const ROLE_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#6b7280', // gray
  '#f97316', // orange
]

interface RolesTabProps {
  projectId: string
}

export function RolesTab({ projectId }: RolesTabProps) {
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId)
  const createRole = useCreateRole(projectId)
  const updateRole = useUpdateRole(projectId)
  const deleteRole = useDeleteRole(projectId)
  const updateMember = useUpdateMember(projectId)
  const removeMember = useRemoveMember(projectId)
  const addMember = useAddMember(projectId)

  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)
  const currentUser = useCurrentUser()

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [addMemberSearch, setAddMemberSearch] = useState('')

  // Available users for adding to this role
  const { data: availableUsers } = useAvailableUsers(projectId, addMemberSearch)

  // Form state for editing
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(ROLE_COLORS[0])
  const [editDescription, setEditDescription] = useState('')
  const [editPermissions, setEditPermissions] = useState<Permission[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Unsaved changes confirmation
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const [pendingRole, setPendingRole] = useState<RoleWithPermissions | null>(null)
  const [rememberPreference, setRememberPreference] = useState(false)
  const { autoSaveOnRoleEditorClose, setAutoSaveOnRoleEditorClose } = useSettingsStore()

  // Delete confirmation
  const [deletingRole, setDeletingRole] = useState<RoleWithPermissions | null>(null)

  // Compare roles dialog
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  // Show diff while editing
  const [showDiff, setShowDiff] = useState(false)
  const [originalPermissions, setOriginalPermissions] = useState<Permission[]>([])

  const isLoading = rolesLoading || membersLoading

  // Get the selected role
  const selectedRole = useMemo(() => {
    if (!selectedRoleId || !roles) return null
    return roles.find((r) => r.id === selectedRoleId) || null
  }, [selectedRoleId, roles])

  // Get members for the selected role
  const roleMembers = useMemo(() => {
    if (!selectedRoleId || !members) return []
    return members.filter((m) => m.roleId === selectedRoleId)
  }, [selectedRoleId, members])

  // Combined search results: members from other roles + available users
  const searchResults = useMemo(() => {
    if (!addMemberSearch.trim()) return []
    const search = addMemberSearch.toLowerCase()

    // Members from other roles (will be moved)
    const otherRoleMembers = (members || [])
      .filter((m) => m.roleId !== selectedRoleId)
      .filter(
        (m) =>
          m.user.name.toLowerCase().includes(search) ||
          m.user.email?.toLowerCase().includes(search),
      )
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        memberId: m.id,
        currentRole: roles?.find((r) => r.id === m.roleId),
        isExistingMember: true as const,
      }))

    // Available users (will be added)
    const newUsers = (availableUsers || []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      memberId: null,
      currentRole: null,
      isExistingMember: false as const,
    }))

    return [...otherRoleMembers, ...newUsers]
  }, [addMemberSearch, members, selectedRoleId, roles, availableUsers])

  // Load role data into form
  const loadRoleData = useCallback((role: RoleWithPermissions) => {
    setEditName(role.name)
    setEditColor(role.color)
    setEditDescription(role.description || '')
    setEditPermissions(role.permissions)
    setOriginalPermissions(role.permissions)
    setHasChanges(false)
    setShowDiff(false)
  }, [])

  // Select the first role by default when roles load
  useEffect(() => {
    if (roles && roles.length > 0 && !selectedRoleId && !isCreating) {
      setSelectedRoleId(roles[0].id)
      loadRoleData(roles[0])
    }
  }, [roles, selectedRoleId, isCreating, loadRoleData])

  // Handle role selection
  const handleSelectRole = (role: RoleWithPermissions) => {
    // Don't switch if already on this role
    if (role.id === selectedRoleId && !isCreating) return

    if (hasChanges) {
      if (autoSaveOnRoleEditorClose) {
        // Auto-save and switch
        handleSave().then(() => {
          setSelectedRoleId(role.id)
          setIsCreating(false)
          loadRoleData(role)
        })
        return
      }
      // Show confirmation dialog
      setPendingRole(role)
      setRememberPreference(false)
      setShowUnsavedConfirm(true)
      return
    }
    setSelectedRoleId(role.id)
    setIsCreating(false)
    loadRoleData(role)
  }

  // Confirm switch without saving
  const handleConfirmDiscard = () => {
    if (pendingRole) {
      setSelectedRoleId(pendingRole.id)
      setIsCreating(false)
      loadRoleData(pendingRole)
    }
    setShowUnsavedConfirm(false)
    setPendingRole(null)
    setRememberPreference(false)
  }

  // Save and switch
  const handleConfirmSaveAndSwitch = async () => {
    if (rememberPreference) {
      setAutoSaveOnRoleEditorClose(true)
    }
    await handleSave()
    if (pendingRole) {
      setSelectedRoleId(pendingRole.id)
      setIsCreating(false)
      loadRoleData(pendingRole)
    }
    setShowUnsavedConfirm(false)
    setPendingRole(null)
    setRememberPreference(false)
  }

  // Handle starting to create a new role
  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedRoleId(null)
    setEditName('')
    setEditColor(ROLE_COLORS[0])
    setEditDescription('')
    setEditPermissions([])
    setHasChanges(false)
  }

  // Check if form values differ from the original role
  const checkForChanges = (
    name: string,
    color: string,
    description: string,
    permissions: Permission[],
  ) => {
    if (isCreating) {
      // For new roles, any non-default values count as changes
      return name.trim() !== '' || description.trim() !== '' || permissions.length > 0
    }
    if (!selectedRole) return false

    const nameChanged = name !== selectedRole.name
    const colorChanged = color !== selectedRole.color
    const descChanged = (description || '') !== (selectedRole.description || '')
    const permsChanged =
      permissions.length !== selectedRole.permissions.length ||
      permissions.some((p) => !selectedRole.permissions.includes(p)) ||
      selectedRole.permissions.some((p) => !permissions.includes(p))

    return nameChanged || colorChanged || descChanged || permsChanged
  }

  // Handle form field changes
  const handleFieldChange = (field: string, value: unknown) => {
    let newName = editName
    let newColor = editColor
    let newDescription = editDescription
    let newPermissions = editPermissions

    switch (field) {
      case 'name':
        newName = value as string
        setEditName(newName)
        break
      case 'color':
        newColor = value as string
        setEditColor(newColor)
        break
      case 'description':
        newDescription = value as string
        setEditDescription(newDescription)
        break
      case 'permissions':
        newPermissions = value as Permission[]
        setEditPermissions(newPermissions)
        break
    }

    setHasChanges(checkForChanges(newName, newColor, newDescription, newPermissions))
  }

  // Save the role
  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error('Role name is required')
      return
    }

    try {
      if (isCreating) {
        const newRole = await createRole.mutateAsync({
          name: editName.trim(),
          color: editColor,
          description: editDescription.trim() || undefined,
          permissions: editPermissions,
        })
        setIsCreating(false)
        setSelectedRoleId(newRole.id)
      } else if (selectedRole) {
        await updateRole.mutateAsync({
          roleId: selectedRole.id,
          name: selectedRole.isDefault ? undefined : editName.trim(),
          color: editColor,
          description: editDescription.trim() || null,
          permissions: editPermissions,
        })
      }
      setHasChanges(false)
    } catch {
      // Error is handled by the mutation
    }
  }

  // Cancel editing
  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false)
      if (roles && roles.length > 0) {
        setSelectedRoleId(roles[0].id)
        loadRoleData(roles[0])
      }
    } else if (selectedRole) {
      loadRoleData(selectedRole)
    }
  }

  // Clone a role
  const handleCloneRole = async (role: RoleWithPermissions) => {
    try {
      const newRole = await createRole.mutateAsync({
        name: `${role.name} (Copy)`,
        color: role.color,
        description: role.description || undefined,
        permissions: role.permissions,
      })
      setSelectedRoleId(newRole.id)
      setIsCreating(false)
      loadRoleData(newRole)
      toast.success(`Cloned role "${role.name}"`)
    } catch {
      // Error handled by mutation
    }
  }

  // Delete a role
  const handleDeleteRole = async () => {
    if (!deletingRole) return
    try {
      await deleteRole.mutateAsync(deletingRole.id)
      setDeletingRole(null)
      // Select first available role
      if (roles && roles.length > 1) {
        const remainingRoles = roles.filter((r) => r.id !== deletingRole.id)
        if (remainingRoles.length > 0) {
          setSelectedRoleId(remainingRoles[0].id)
          loadRoleData(remainingRoles[0])
        }
      }
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full min-h-[500px]">
      {/* Left Panel - Role List */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
          <div className="flex items-center gap-1">
            {roles && roles.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompareDialog(true)}
                title="Compare Roles"
              >
                <GitCompare className="h-4 w-4" />
              </Button>
            )}
            {canManageRoles && (
              <Button variant="ghost" size="sm" onClick={handleStartCreate}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-3">
            {roles?.map((role) => (
              <div
                key={role.id}
                className={cn(
                  'group flex items-center gap-1 rounded-md transition-colors',
                  selectedRoleId === role.id && !isCreating
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-800/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-3 py-2 text-left transition-colors min-w-0',
                    selectedRoleId === role.id && !isCreating
                      ? 'text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{role.name}</span>
                      {role.isDefault && <Lock className="h-3 w-3 text-zinc-600 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{role.memberCount || 0} members</span>
                    </div>
                  </div>
                </button>
                {canManageRoles && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 mr-1 text-zinc-500 hover:text-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCloneRole(role)
                        }}
                        disabled={createRole.isPending}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingRole(role)
                        }}
                        disabled={role.isDefault || (role.memberCount || 0) > 0}
                        className="text-red-400 focus:text-red-400"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            {isCreating && (
              <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-amber-900/20 border border-amber-700/50">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: editColor }}
                />
                <span className="text-sm font-medium text-amber-400">{editName || 'New Role'}</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Role Editor */}
      <div className="flex-1 min-w-0">
        {selectedRole || isCreating ? (
          <Tabs defaultValue="permissions" className="h-full flex flex-col">
            {/* Tab bar */}
            <div className="mb-4">
              <TabsList className="w-full grid grid-cols-2 h-auto p-0 bg-transparent rounded-none gap-0">
                <TabsTrigger
                  value="permissions"
                  className="!rounded-none !rounded-l-lg !border !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="!rounded-none !rounded-r-lg !border !border-l-0 !border-zinc-600 !bg-zinc-800 !text-zinc-300 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-600 data-[state=active]:!text-white data-[state=active]:!border-amber-600 hover:!bg-zinc-700 hover:!text-white disabled:!opacity-50"
                  disabled={isCreating}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Members ({roleMembers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <Card className="flex-1 flex flex-col bg-zinc-900/50 border-zinc-800 min-h-0">
              <CardHeader className="flex-shrink-0 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: editColor }} />
                  {canManageRoles && !selectedRole?.isDefault ? (
                    <div className="group/title relative flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative">
                        <Input
                          value={editName}
                          onChange={(e) => handleFieldChange('name', e.target.value)}
                          placeholder="Role name..."
                          className="!text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 cursor-text"
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700 group-hover/title:bg-zinc-500 group-focus-within/title:bg-amber-500 transition-colors" />
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover/title:text-zinc-400 group-focus-within/title:text-amber-500 transition-colors flex-shrink-0" />
                    </div>
                  ) : (
                    <CardTitle className="text-lg">{editName || 'New Role'}</CardTitle>
                  )}
                  {selectedRole?.isDefault && (
                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                      <Lock className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {isCreating
                    ? 'Create a new role with custom permissions.'
                    : `Configure permissions and manage members for this role.`}
                </CardDescription>
              </CardHeader>

              <TabsContent value="permissions" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full">
                  <CardContent className="pt-0 space-y-4">
                    {/* Color */}
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex gap-1">
                        {ROLE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleFieldChange('color', c)}
                            disabled={!canManageRoles}
                            className={cn(
                              'w-6 h-6 rounded-md transition-all',
                              editColor === c
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                                : 'hover:scale-110',
                              !canManageRoles && 'opacity-50 cursor-not-allowed',
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="role-description">Description (optional)</Label>
                      <Textarea
                        id="role-description"
                        value={editDescription}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        placeholder="Describe what this role can do..."
                        disabled={!canManageRoles}
                        className="bg-zinc-800/50 resize-none border-zinc-700 hover:border-zinc-500"
                        rows={2}
                      />
                    </div>

                    {/* Permissions */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Permissions</Label>
                        {!isCreating && hasChanges && (
                          <label
                            htmlFor="show-diff"
                            className="flex items-center gap-2 cursor-pointer select-none"
                          >
                            <span className="text-xs text-zinc-500">Show changes</span>
                            <Checkbox
                              id="show-diff"
                              checked={showDiff}
                              onCheckedChange={(checked) => setShowDiff(checked === true)}
                              className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            />
                          </label>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mb-3">
                        Select the actions members with this role can perform.
                      </p>
                      <PermissionGrid
                        selectedPermissions={editPermissions}
                        onChange={(perms) => handleFieldChange('permissions', perms)}
                        disabled={!canManageRoles}
                        originalPermissions={originalPermissions}
                        showDiff={showDiff && !isCreating}
                      />
                    </div>
                  </CardContent>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="members" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full">
                  <CardContent className="pt-0 space-y-4">
                    {/* Add member section */}
                    {canManageRoles && selectedRoleId && (
                      <div className="space-y-2">
                        <Label>Add member to this role</Label>
                        <div className="relative">
                          <Input
                            value={addMemberSearch}
                            onChange={(e) => setAddMemberSearch(e.target.value)}
                            placeholder="Search users to add..."
                            className="bg-zinc-800/50 border-zinc-700 hover:border-zinc-500"
                          />
                          {addMemberSearch && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-10 max-h-48 overflow-auto">
                              {searchResults.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    if (user.isExistingMember && user.memberId) {
                                      updateMember.mutate({
                                        memberId: user.memberId,
                                        roleId: selectedRoleId,
                                      })
                                    } else {
                                      addMember.mutate({ userId: user.id, roleId: selectedRoleId })
                                    }
                                    setAddMemberSearch('')
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 transition-colors text-left"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                                    <AvatarFallback
                                      className="text-xs"
                                      style={{ backgroundColor: getAvatarColor(user.id) }}
                                    >
                                      {getInitials(user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm text-zinc-200 truncate">{user.name}</p>
                                      {user.currentRole && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-4 border-zinc-600"
                                          style={{ color: user.currentRole.color }}
                                        >
                                          {user.currentRole.name}
                                        </Badge>
                                      )}
                                    </div>
                                    {user.email && (
                                      <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                                    )}
                                    {user.currentRole && (
                                      <p className="text-xs text-amber-500/70 mt-0.5">
                                        Will move from {user.currentRole.name}
                                      </p>
                                    )}
                                  </div>
                                  <UserPlus className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                          {addMemberSearch && searchResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-10 px-3 py-2 text-sm text-zinc-500">
                              No users found
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Members list */}
                    {roleMembers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <Users className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">No members with this role</p>
                        <p className="text-xs mt-1">Use the search above to add members</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Members ({roleMembers.length})</Label>
                        {(() => {
                          const currentMember = roleMembers.find(
                            (m) => m.userId === currentUser?.id,
                          )
                          const otherMembers = roleMembers.filter(
                            (m) => m.userId !== currentUser?.id,
                          )

                          const renderMemberRow = (
                            member: (typeof roleMembers)[0],
                            isCurrentUser = false,
                          ) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={member.user.avatar || undefined}
                                    alt={member.user.name}
                                  />
                                  <AvatarFallback
                                    className="text-xs font-medium"
                                    style={{
                                      backgroundColor: getAvatarColor(
                                        member.user.id || member.user.name,
                                      ),
                                    }}
                                  >
                                    {getInitials(member.user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-zinc-200">
                                      {member.user.name}
                                    </p>
                                    {isCurrentUser && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 border-amber-600 text-amber-500"
                                      >
                                        You
                                      </Badge>
                                    )}
                                  </div>
                                  {member.user.email && (
                                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                                  )}
                                </div>
                              </div>
                              {canManageRoles && (
                                <div className="flex items-center gap-1">
                                  {roles && roles.length > 1 && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"
                                        >
                                          <ArrowRightLeft className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="min-w-[140px]">
                                        {roles
                                          .filter((r) => r.id !== selectedRoleId)
                                          .map((role) => (
                                            <DropdownMenuItem
                                              key={role.id}
                                              onClick={() =>
                                                updateMember.mutate({
                                                  memberId: member.id,
                                                  roleId: role.id,
                                                })
                                              }
                                              className="gap-2"
                                            >
                                              <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: role.color }}
                                              />
                                              {role.name}
                                            </DropdownMenuItem>
                                          ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeMember.mutate(member.id)}
                                    disabled={removeMember.isPending}
                                    className="text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )

                          return (
                            <>
                              {currentMember && (
                                <>
                                  {renderMemberRow(currentMember, true)}
                                  {otherMembers.length > 0 && (
                                    <div className="flex items-center gap-3 py-2">
                                      <div className="flex-1 h-px bg-zinc-800" />
                                      <span className="text-xs text-zinc-600 uppercase tracking-wider">
                                        Other Members
                                      </span>
                                      <div className="flex-1 h-px bg-zinc-800" />
                                    </div>
                                  )}
                                </>
                              )}
                              {otherMembers.map((member) => renderMemberRow(member, false))}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </CardContent>
                </ScrollArea>
              </TabsContent>

              {/* Footer bar with save/cancel actions */}
              {canManageRoles && hasChanges && (
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
                  <p className="text-sm text-zinc-400">You have unsaved changes</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={createRole.isPending || updateRole.isPending}
                    >
                      {(createRole.isPending || updateRole.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isCreating ? 'Create Role' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Tabs>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a role to view its permissions</p>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved changes confirmation dialog */}
      <AlertDialog
        open={showUnsavedConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowUnsavedConfirm(false)
            setPendingRole(null)
            setRememberPreference(false)
          }
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You have unsaved changes to this role. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-role-preference"
                checked={rememberPreference}
                onCheckedChange={(checked) => setRememberPreference(checked === true)}
                className="border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label
                htmlFor="remember-role-preference"
                className="text-sm text-zinc-300 cursor-pointer select-none"
              >
                Remember my preference to save and switch
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => {
                setShowUnsavedConfirm(false)
                setPendingRole(null)
                setRememberPreference(false)
              }}
            >
              Go Back
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDiscard}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={handleConfirmSaveAndSwitch}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Save and Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete role confirmation dialog */}
      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Role</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deletingRole?.isDefault ? (
                'Default roles cannot be deleted.'
              ) : (deletingRole?.memberCount || 0) > 0 ? (
                <>
                  This role has{' '}
                  <span className="text-zinc-200 font-medium">
                    {deletingRole?.memberCount} member
                    {(deletingRole?.memberCount || 0) !== 1 ? 's' : ''}
                  </span>
                  . Reassign them to another role before deleting.
                </>
              ) : (
                <>
                  Are you sure you want to delete the role{' '}
                  <span className="text-zinc-200 font-medium">"{deletingRole?.name}"</span>? This
                  action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            {!deletingRole?.isDefault && (deletingRole?.memberCount || 0) === 0 && (
              <AlertDialogAction
                onClick={handleDeleteRole}
                className="bg-red-600 hover:bg-red-500 text-white"
                disabled={deleteRole.isPending}
              >
                {deleteRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Role
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compare roles dialog */}
      {roles && roles.length >= 2 && (
        <RoleCompareDialog
          open={showCompareDialog}
          onOpenChange={setShowCompareDialog}
          roles={roles}
        />
      )}
    </div>
  )
}
