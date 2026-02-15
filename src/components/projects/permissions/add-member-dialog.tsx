'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { availableUserKeys, memberKeys, useAvailableUsers } from '@/hooks/queries/use-members'
import { useProjectRoles } from '@/hooks/queries/use-roles'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'
import { cn, getAvatarColor } from '@/lib/utils'
import { type MemberSnapshot, useAdminUndoStore } from '@/stores/admin-undo-store'

interface AddMemberDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

interface PendingMember {
  user: {
    id: string
    name: string
    email: string | null
    avatar: string | null
    avatarColor: string | null
  }
  roleId: string
}

export function AddMemberDialog({ projectId, trigger }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [bulkRoleId, setBulkRoleId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const queryClient = useQueryClient()
  const { data: availableUsers, isLoading: usersLoading } = useAvailableUsers(projectId, search)
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const { pushMemberAdd } = useAdminUndoStore()

  // Find default role (Member role, or first non-Owner role)
  const defaultRole =
    roles?.find((r) => r.name === 'Member') ?? roles?.find((r) => r.name !== 'Owner')

  // Filter out users already in the pending queue
  const pendingUserIds = new Set(pendingMembers.map((m) => m.user.id))
  const filteredAvailableUsers = availableUsers?.filter((u) => !pendingUserIds.has(u.id))

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setSearch('')
      setPendingMembers([])
      setBulkRoleId('')
    }
  }, [])

  const handleAddToQueue = (user: PendingMember['user']) => {
    if (!defaultRole) return
    setPendingMembers((prev) => [...prev, { user, roleId: defaultRole.id }])
    setSearch('')
    setUserSearchOpen(false)
  }

  const handleAddAllUsers = () => {
    if (!defaultRole || !filteredAvailableUsers?.length) return
    const newMembers = filteredAvailableUsers.map((user) => ({ user, roleId: defaultRole.id }))
    setPendingMembers((prev) => [...prev, ...newMembers])
    setSearch('')
  }

  const handleRemoveFromQueue = (userId: string) => {
    setPendingMembers((prev) => prev.filter((m) => m.user.id !== userId))
  }

  const handleRoleChange = (userId: string, roleId: string) => {
    setPendingMembers((prev) => prev.map((m) => (m.user.id === userId ? { ...m, roleId } : m)))
  }

  const handleSetAllRoles = () => {
    if (!bulkRoleId) return
    setPendingMembers((prev) => prev.map((m) => ({ ...m, roleId: bulkRoleId })))
  }

  const handleSubmit = async () => {
    if (pendingMembers.length === 0) return

    setIsSubmitting(true)
    const count = pendingMembers.length

    // Get role names for snapshots
    const getRoleName = (roleId: string) => roles?.find((r) => r.id === roleId)?.name || 'Member'

    try {
      // Add all members in parallel (direct API calls to avoid per-member toasts)
      const results = await Promise.all(
        pendingMembers.map(async (member) => {
          const res = await fetch(`/api/projects/${projectId}/members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tab-Id': getTabId(),
            },
            body: JSON.stringify({ userId: member.user.id, roleId: member.roleId }),
          })
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to add member')
          }
          const data = await res.json()
          return { member, membershipId: data.id }
        }),
      )

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
      queryClient.invalidateQueries({ queryKey: availableUserKeys.byProject(projectId) })

      // Create snapshots for undo
      const memberSnapshots: MemberSnapshot[] = results.map(({ member, membershipId }) => ({
        membershipId,
        projectId,
        userId: member.user.id,
        userName: member.user.name,
        roleId: member.roleId,
        roleName: getRoleName(member.roleId),
      }))

      // Push to undo stack
      pushMemberAdd(projectId, memberSnapshots)

      // Single toast for all members
      showToast.success(`Added ${count} member${count !== 1 ? 's' : ''} (Ctrl+Z to undo)`)
      handleOpenChange(false)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to add members')
    } finally {
      setIsSubmitting(false)
    }
  }

  const assignableRoles = roles || []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Search and select users to add to this project. You can add multiple users with
            different roles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Search */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-200">Search Users</Label>
              {filteredAvailableUsers && filteredAvailableUsers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
                  onClick={handleAddAllUsers}
                >
                  <Users className="mr-1.5 h-3 w-3" />
                  Add all ({filteredAvailableUsers.length})
                </Button>
              )}
            </div>
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userSearchOpen}
                  className="w-full justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                >
                  <span className="text-zinc-500">Search for users to add...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search users..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>
                          {search ? 'No users found.' : 'Type to search for users...'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredAvailableUsers?.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={() => handleAddToQueue(user)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.avatar || undefined} />
                                  <AvatarFallback
                                    className="text-[10px] text-white font-medium"
                                    style={{
                                      backgroundColor:
                                        user.avatarColor || getAvatarColor(user.id || user.name),
                                    }}
                                  >
                                    {user.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm">{user.name}</p>
                                  {user.email && (
                                    <p className="truncate text-xs text-zinc-400">{user.email}</p>
                                  )}
                                </div>
                              </div>
                              <Check className="ml-2 h-4 w-4 opacity-0" />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Pending Members Queue */}
          {pendingMembers.length > 0 && (
            <div className="space-y-3">
              <Label className="text-zinc-200">Members to add ({pendingMembers.length})</Label>

              <ScrollArea className={cn(pendingMembers.length > 3 && 'h-[200px]')}>
                <div className="space-y-2 pr-3">
                  {pendingMembers.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={member.user.avatar || undefined} />
                        <AvatarFallback
                          className="text-xs text-white font-medium"
                          style={{
                            backgroundColor:
                              member.user.avatarColor ||
                              getAvatarColor(member.user.id || member.user.name),
                          }}
                        >
                          {member.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {member.user.name}
                        </p>
                        {member.user.email && (
                          <p className="text-xs text-zinc-500 truncate">{member.user.email}</p>
                        )}
                      </div>

                      <Select
                        value={member.roleId}
                        onValueChange={(value) => handleRoleChange(member.user.id, value)}
                      >
                        <SelectTrigger className="w-[120px] h-8 bg-zinc-800/50 border-zinc-700 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: role.color }}
                                />
                                <span>{role.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                        onClick={() => handleRemoveFromQueue(member.user.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Bulk role assignment */}
              {pendingMembers.length > 1 && (
                <div className="flex items-center gap-2 pt-3 mt-1 border-t border-zinc-800">
                  <span className="text-sm text-zinc-200 shrink-0">Set all roles to:</span>
                  <Select value={bulkRoleId} onValueChange={setBulkRoleId}>
                    <SelectTrigger className="flex-1 h-8 bg-zinc-800/50 border-zinc-700 text-sm">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: role.color }}
                            />
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={handleSetAllRoles}
                    disabled={!bulkRoleId}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {pendingMembers.length === 0 && !rolesLoading && (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Search and select users above to add them to the project.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={pendingMembers.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add {pendingMembers.length || ''} Member{pendingMembers.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
