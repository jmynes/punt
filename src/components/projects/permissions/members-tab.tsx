'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  CheckSquare,
  Loader2,
  Minus,
  Search,
  Settings,
  Square,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AddMemberDialog } from '@/components/projects/permissions/add-member-dialog'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { memberKeys, useProjectMembers, useUpdateMember } from '@/hooks/queries/use-members'
import { useProjectRoles } from '@/hooks/queries/use-roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useHasPermission } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { PERMISSIONS } from '@/lib/permissions'
import { cn, getAvatarColor } from '@/lib/utils'
import type { ProjectMemberWithRole } from '@/types'

interface MembersTabProps {
  projectId: string
}

export function MembersTab({ projectId }: MembersTabProps) {
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId)
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const updateMember = useUpdateMember(projectId)
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()

  const canManageMembers = useHasPermission(projectId, PERMISSIONS.MEMBERS_MANAGE)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // Search state
  const [search, setSearch] = useState('')

  // Dialog state
  const [removingMember, setRemovingMember] = useState<ProjectMemberWithRole | null>(null)
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!members) return []
    if (!search.trim()) return members

    const searchLower = search.toLowerCase()
    return members.filter(
      (m) =>
        m.user.name.toLowerCase().includes(searchLower) ||
        m.user.email?.toLowerCase().includes(searchLower) ||
        m.role.name.toLowerCase().includes(searchLower),
    )
  }, [members, search])

  // Split into current user and other members
  const currentMember = filteredMembers.find((m) => m.userId === currentUser?.id)
  const otherMembers = filteredMembers.filter((m) => m.userId !== currentUser?.id)

  // Selection helpers
  const allOthersSelected =
    otherMembers.length > 0 && otherMembers.every((m) => selectedIds.has(m.id))
  const someSelected = selectedIds.size > 0

  const handleSelect = useCallback(
    (memberId: string, shiftKey: boolean) => {
      // Shift-click range selection
      if (shiftKey && lastSelectedId && otherMembers.length > 0) {
        const memberIds = otherMembers.map((m) => m.id)
        const lastIndex = memberIds.indexOf(lastSelectedId)
        const currentIndex = memberIds.indexOf(memberId)

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)
          const rangeIds = memberIds.slice(start, end + 1)

          setSelectedIds((prev) => {
            const next = new Set(prev)
            const allSelected = rangeIds.every((id) => prev.has(id))
            for (const id of rangeIds) {
              if (allSelected) {
                next.delete(id)
              } else {
                next.add(id)
              }
            }
            return next
          })
          return
        }
      }

      // Normal toggle
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(memberId)) {
          next.delete(memberId)
        } else {
          next.add(memberId)
        }
        return next
      })
      setLastSelectedId(memberId)
    },
    [lastSelectedId, otherMembers],
  )

  const selectAll = () => {
    setSelectedIds(new Set(otherMembers.map((m) => m.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const handleRoleChange = async (memberId: string, roleId: string) => {
    await updateMember.mutateAsync({ memberId, roleId })
  }

  const handleRemoveMember = async () => {
    if (!removingMember) return
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${removingMember.id}`, {
        method: 'DELETE',
        headers: { 'X-Tab-Id': getTabId() },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove member')
      }
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
      toast.success('Member removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
    setRemovingMember(null)
  }

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return

    setIsRemoving(true)
    const count = selectedIds.size
    try {
      await Promise.all(
        [...selectedIds].map(async (memberId) => {
          const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
            method: 'DELETE',
            headers: { 'X-Tab-Id': getTabId() },
          })
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to remove member')
          }
        }),
      )
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
      toast.success(`Removed ${count} member${count !== 1 ? 's' : ''}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove members')
    } finally {
      setIsRemoving(false)
      setShowBulkRemoveDialog(false)
    }
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
          <AddMemberDialog
            projectId={projectId}
            trigger={
              <Button variant="primary">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            }
          />
        )}
      </div>

      {/* Search */}
      {members && members.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      )}

      {/* Select All Row */}
      {canManageMembers && otherMembers.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={allOthersSelected ? selectNone : selectAll}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {allOthersSelected ? (
              <CheckSquare className="h-4 w-4 text-amber-500" />
            ) : someSelected ? (
              <Minus className="h-4 w-4 text-amber-500" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={selectNone}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="space-y-2">
        {/* Current user section */}
        {currentMember && (
          <>
            <MemberCard
              member={currentMember}
              roles={roles || []}
              isCurrentUser={true}
              isSelected={false}
              canSelect={false}
              canChangeRole={canManageMembers === true}
              onSelect={() => {}}
              onRoleChange={(roleId) => handleRoleChange(currentMember.id, roleId)}
              onRemove={() => setRemovingMember(currentMember)}
            />
            {otherMembers.length > 0 && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600 uppercase tracking-wider">
                  Other Members
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
            )}
          </>
        )}

        {/* Other members */}
        {otherMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            roles={roles || []}
            isCurrentUser={false}
            isSelected={selectedIds.has(member.id)}
            canSelect={canManageMembers === true}
            canChangeRole={canManageMembers === true}
            onSelect={(shiftKey) => handleSelect(member.id, shiftKey)}
            onRoleChange={(roleId) => handleRoleChange(member.id, roleId)}
            onRemove={() => setRemovingMember(member)}
          />
        ))}

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            {search ? 'No members match your search.' : 'No members found.'}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50">
            <span className="text-sm text-zinc-300 font-medium pr-2 border-r border-zinc-700">
              {selectedIds.size} selected
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              onClick={() => setShowBulkRemoveDialog(true)}
            >
              <UserMinus className="h-4 w-4 mr-1.5" />
              Remove
            </Button>

            <div className="w-px h-6 bg-zinc-700" />

            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
              onClick={selectNone}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Single Remove Member Confirmation */}
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
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700 text-white"
              autoFocus
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Remove Confirmation */}
      <AlertDialog open={showBulkRemoveDialog} onOpenChange={setShowBulkRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedIds.size} Members</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedIds.size} member
              {selectedIds.size !== 1 ? 's' : ''} from this project? They will lose access to all
              project resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRemove}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isRemoving}
              autoFocus
            >
              {isRemoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                `Remove ${selectedIds.size} Member${selectedIds.size !== 1 ? 's' : ''}`
              )}
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
  isSelected: boolean
  canSelect: boolean
  canChangeRole: boolean
  onSelect: (shiftKey: boolean) => void
  onRoleChange: (roleId: string) => void
  onRemove: () => void
}

function MemberCard({
  member,
  roles,
  isCurrentUser,
  isSelected,
  canSelect,
  canChangeRole,
  onSelect,
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
    <Card
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault()
      }}
      onClick={(e) => {
        if (canSelect && !isCurrentUser) {
          onSelect(e.shiftKey)
        }
      }}
      className={cn(
        'bg-zinc-900/50 border-zinc-800 transition-all duration-150',
        canSelect && !isCurrentUser && 'cursor-pointer',
        isSelected && 'ring-1 ring-amber-500/50 bg-amber-500/5 border-amber-500/30',
        canSelect && !isCurrentUser && !isSelected && 'hover:bg-zinc-900/80',
      )}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {/* Checkbox */}
          {canSelect && !isCurrentUser && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect(false)}
              onClick={(e) => e.stopPropagation()}
              className="border-zinc-500 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-600"
            />
          )}

          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.user.avatar || undefined} alt={member.user.name} />
            <AvatarFallback
              className="text-white font-medium"
              style={{ backgroundColor: getAvatarColor(member.user.id || member.user.name) }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* User info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{member.user.name}</span>
              {isCurrentUser && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 border-amber-600 text-amber-500"
                >
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
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {/* Role selector or badge */}
          {canChangeRole ? (
            <Select value={member.roleId} onValueChange={onRoleChange}>
              <SelectTrigger className="w-[140px] bg-zinc-800/50">
                <SelectValue />
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

          {/* Remove button */}
          {(canChangeRole || isCurrentUser) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
              onClick={onRemove}
              title={isCurrentUser ? 'Leave Project' : 'Remove from Project'}
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
