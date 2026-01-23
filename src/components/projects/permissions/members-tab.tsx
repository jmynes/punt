'use client'

import { Loader2, MoreHorizontal, Settings, Shield, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjectMembers, useRemoveMember, useUpdateMember } from '@/hooks/queries/use-members'
import { useProjectRoles } from '@/hooks/queries/use-roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import type { ProjectMemberWithRole } from '@/types'

interface MembersTabProps {
  projectId: string
}

export function MembersTab({ projectId }: MembersTabProps) {
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId)
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const updateMember = useUpdateMember(projectId)
  const removeMember = useRemoveMember(projectId)
  const currentUser = useCurrentUser()

  const canManageMembers = useHasPermission(projectId, PERMISSIONS.MEMBERS_MANAGE)
  const canManagePermissions = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)

  const [removingMember, setRemovingMember] = useState<ProjectMemberWithRole | null>(null)

  const handleRoleChange = async (memberId: string, roleId: string) => {
    await updateMember.mutateAsync({ memberId, roleId })
  }

  const handleRemoveMember = async () => {
    if (!removingMember) return
    await removeMember.mutateAsync(removingMember.id)
    setRemovingMember(null)
  }

  const isLoading = membersLoading || rolesLoading

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
          <h3 className="text-lg font-medium text-zinc-100">Members</h3>
          <p className="text-sm text-zinc-500">
            Manage team members and their roles in this project.
          </p>
        </div>
        {canManageMembers && (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {members?.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            roles={roles || []}
            isCurrentUser={member.userId === currentUser?.id}
            canChangeRole={canManageMembers === true}
            canManagePermissions={canManagePermissions === true}
            onRoleChange={(roleId) => handleRoleChange(member.id, roleId)}
            onRemove={() => setRemovingMember(member)}
          />
        ))}

        {members?.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No members found.</div>
        )}
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingMember?.user.name} from this project? They
              will lose access to all project resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface MemberCardProps {
  member: ProjectMemberWithRole
  roles: Array<{ id: string; name: string; color: string; position: number }>
  isCurrentUser: boolean
  canChangeRole: boolean
  canManagePermissions: boolean
  onRoleChange: (roleId: string) => void
  onRemove: () => void
}

function MemberCard({
  member,
  roles,
  isCurrentUser,
  canChangeRole,
  canManagePermissions,
  onRoleChange,
  onRemove,
}: MemberCardProps) {
  const initials = member.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const hasOverrides = member.overrides && member.overrides.length > 0

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.user.avatar || undefined} alt={member.user.name} />
            <AvatarFallback className="bg-zinc-700 text-zinc-300">{initials}</AvatarFallback>
          </Avatar>

          {/* User info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{member.user.name}</span>
              {isCurrentUser && (
                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                  You
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500">{member.user.email}</p>
            {hasOverrides && (
              <div className="flex items-center gap-1 mt-1">
                <Settings className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-amber-500">
                  +{(member.overrides as string[]).length} custom permission
                  {(member.overrides as string[]).length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Role & Actions */}
        <div className="flex items-center gap-3">
          {/* Role selector or badge */}
          {canChangeRole && !isCurrentUser ? (
            <Select value={member.roleId} onValueChange={onRoleChange}>
              <SelectTrigger className="w-[140px] bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: member.role.color }}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge
              variant="outline"
              className="border-zinc-700"
              style={{
                backgroundColor: `${member.role.color}20`,
                borderColor: member.role.color,
                color: member.role.color,
              }}
            >
              {member.role.name}
            </Badge>
          )}

          {/* Actions dropdown */}
          {(canChangeRole || canManagePermissions) && !isCurrentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManagePermissions && (
                  <DropdownMenuItem>
                    <Shield className="mr-2 h-4 w-4" />
                    Edit Permissions
                  </DropdownMenuItem>
                )}
                {canChangeRole && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onRemove}
                      className="text-red-400 focus:text-red-400"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Remove from Project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Leave button for current user */}
          {isCurrentUser && member.role.name !== 'Owner' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-zinc-400 hover:text-red-400"
            >
              Leave
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
