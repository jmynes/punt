'use client'

import { Loader2, Lock, Plus, Shield, Users } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useProjectMembers, useUpdateMember } from '@/hooks/queries/use-members'
import { useCreateRole, useProjectRoles, useUpdateRole } from '@/hooks/queries/use-roles'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import type { Permission, RoleWithPermissions } from '@/types'
import { PermissionGrid } from './permission-grid'

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
  const updateMember = useUpdateMember(projectId)

  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

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

  // Load role data into form
  const loadRoleData = useCallback((role: RoleWithPermissions) => {
    setEditName(role.name)
    setEditColor(role.color)
    setEditDescription(role.description || '')
    setEditPermissions(role.permissions)
    setHasChanges(false)
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

  // Handle form field changes
  const handleFieldChange = (field: string, value: unknown) => {
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
    setHasChanges(true)
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

  // Change member's role
  const handleChangeMemberRole = async (memberId: string, newRoleId: string) => {
    await updateMember.mutateAsync({
      memberId,
      roleId: newRoleId,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Left Panel - Role List */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Roles</h3>
          {canManageRoles && (
            <Button variant="ghost" size="sm" onClick={handleStartCreate}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-3">
            {roles?.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelectRole(role)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                  selectedRoleId === role.id && !isCreating
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
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
            {/* Header bar with tabs and actions */}
            <div className="flex items-center gap-3 mb-4">
              <TabsList className="flex-1 grid grid-cols-2 h-auto p-0 bg-transparent rounded-none gap-0">
                <TabsTrigger
                  value="permissions"
                  className="!rounded-none !rounded-l-lg !border !border-zinc-700 !bg-zinc-800/50 !text-zinc-400 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-500 data-[state=active]:!text-white data-[state=active]:!border-amber-500 hover:!bg-zinc-700/50 hover:!text-zinc-200"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="!rounded-none !rounded-r-lg !border !border-l-0 !border-zinc-700 !bg-zinc-800/50 !text-zinc-400 py-2.5 px-4 text-sm font-medium transition-colors data-[state=active]:!bg-amber-500 data-[state=active]:!text-white data-[state=active]:!border-amber-500 hover:!bg-zinc-700/50 hover:!text-zinc-200 disabled:!opacity-50"
                  disabled={isCreating}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Members ({roleMembers.length})
                </TabsTrigger>
              </TabsList>

              {canManageRoles && hasChanges && (
                <div className="flex items-center gap-2 flex-shrink-0">
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
                    {isCreating ? 'Create' : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            <Card className="flex-1 flex flex-col bg-zinc-900/50 border-zinc-800 min-h-0">
              <CardHeader className="flex-shrink-0 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: editColor }} />
                  <CardTitle className="text-lg">
                    {isCreating ? 'New Role' : selectedRole?.name}
                  </CardTitle>
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
                    {/* Role Name & Color */}
                    <div className="grid grid-cols-[1fr,auto] gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="role-name">Role Name</Label>
                        <Input
                          id="role-name"
                          value={editName}
                          onChange={(e) => handleFieldChange('name', e.target.value)}
                          placeholder="e.g., Moderator, Contributor"
                          disabled={!canManageRoles || (selectedRole?.isDefault && !isCreating)}
                          className="bg-zinc-800/50"
                        />
                        {selectedRole?.isDefault && (
                          <p className="text-xs text-zinc-500">
                            Default role names cannot be changed.
                          </p>
                        )}
                      </div>

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
                        className="bg-zinc-800/50 resize-none"
                        rows={2}
                      />
                    </div>

                    {/* Permissions */}
                    <div className="space-y-2">
                      <Label>Permissions</Label>
                      <p className="text-xs text-zinc-500 mb-3">
                        Select the actions members with this role can perform.
                      </p>
                      <PermissionGrid
                        selectedPermissions={editPermissions}
                        onChange={(perms) => handleFieldChange('permissions', perms)}
                        disabled={!canManageRoles}
                      />
                    </div>
                  </CardContent>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="members" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full">
                  <CardContent className="pt-0">
                    {roleMembers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <Users className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">No members with this role</p>
                        <p className="text-xs mt-1">
                          Assign this role to members in the Members tab
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {roleMembers.map((member) => (
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
                                <p className="text-sm font-medium text-zinc-200">
                                  {member.user.name}
                                </p>
                                {member.user.email && (
                                  <p className="text-xs text-zinc-500">{member.user.email}</p>
                                )}
                              </div>
                            </div>
                            {canManageRoles && roles && roles.length > 1 && (
                              <select
                                value={member.roleId}
                                onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                                className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </ScrollArea>
              </TabsContent>
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
    </div>
  )
}
