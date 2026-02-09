'use client'

import { Loader2, Lock, Pencil, Plus, Shield, Users } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCreateRole, useProjectRoles, useUpdateRole } from '@/hooks/queries/use-roles'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import type { RoleWithPermissions } from '@/types'
import { RoleEditorDialog, type RoleFormData } from './role-editor-dialog'

interface RolesTabProps {
  projectId: string
}

export function RolesTab({ projectId }: RolesTabProps) {
  const { data: roles, isLoading } = useProjectRoles(projectId)
  const createRole = useCreateRole(projectId)
  const updateRole = useUpdateRole(projectId)

  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null)

  const handleCreateRole = async (data: RoleFormData) => {
    await createRole.mutateAsync(data)
  }

  const handleUpdateRole = async (data: RoleFormData) => {
    if (!editingRole) return
    await updateRole.mutateAsync({
      roleId: editingRole.id,
      ...data,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-100">Roles</h3>
          <p className="text-sm text-zinc-500">
            Manage roles and their permissions for this project.
          </p>
        </div>
        {canManageRoles && (
          <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        )}
      </div>

      {/* Roles List */}
      <div className="space-y-3">
        {roles?.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            canEdit={canManageRoles === true}
            onEdit={() => setEditingRole(role)}
          />
        ))}

        {roles?.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No roles found. Create your first role to get started.
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <RoleEditorDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateRole}
      />

      {/* Edit Dialog */}
      <RoleEditorDialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
        onSave={handleUpdateRole}
        initialData={
          editingRole
            ? {
                name: editingRole.name,
                color: editingRole.color,
                description: editingRole.description || '',
                permissions: editingRole.permissions,
              }
            : undefined
        }
        isEditing
        isDefault={editingRole?.isDefault}
      />
    </div>
  )
}

interface RoleCardProps {
  role: RoleWithPermissions
  canEdit: boolean
  onEdit: () => void
}

function RoleCard({ role, canEdit, onEdit }: RoleCardProps) {
  const permissionCount = role.permissions.length
  const memberCount = role.memberCount || 0

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {/* Role color indicator */}
          <div className="w-3 h-10 rounded-full" style={{ backgroundColor: role.color }} />

          {/* Role info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{role.name}</span>
              {role.isDefault && (
                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                  <Lock className="mr-1 h-3 w-3" />
                  Default
                </Badge>
              )}
            </div>
            {role.description && <p className="text-sm text-zinc-500 mt-0.5">{role.description}</p>}
            <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {permissionCount === 0
                  ? 'View only'
                  : `${permissionCount} permission${permissionCount !== 1 ? 's' : ''}`}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
