'use client'

import { Check, ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAddMember, useAvailableUsers } from '@/hooks/queries/use-members'
import { useProjectRoles } from '@/hooks/queries/use-roles'
import { cn, getAvatarColor } from '@/lib/utils'

interface AddMemberDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

export function AddMemberDialog({ projectId, trigger }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const { data: availableUsers, isLoading: usersLoading } = useAvailableUsers(projectId, search)
  const { data: roles, isLoading: rolesLoading } = useProjectRoles(projectId)
  const addMember = useAddMember(projectId)

  // Find default role (Member role, or first non-Owner role)
  const defaultRole =
    roles?.find((r) => r.name === 'Member') ?? roles?.find((r) => r.name !== 'Owner')

  const selectedUser = availableUsers?.find((u) => u.id === selectedUserId)

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setSearch('')
      setSelectedUserId(null)
      setSelectedRoleId(null)
    }
  }, [])

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedRoleId) return

    await addMember.mutateAsync({
      userId: selectedUserId,
      roleId: selectedRoleId,
    })

    handleOpenChange(false)
  }

  const isValid = selectedUserId && selectedRoleId
  const isSubmitting = addMember.isPending

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
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Add a user to this project. They will be able to access project resources based on their
            role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Search */}
          <div className="space-y-2">
            <Label className="text-zinc-200">User</Label>
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userSearchOpen}
                  className="w-full justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                >
                  {selectedUser ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedUser.avatar || undefined} />
                        <AvatarFallback
                          className="text-[10px] text-white font-medium"
                          style={{
                            backgroundColor: getAvatarColor(selectedUser.id || selectedUser.name),
                          }}
                        >
                          {selectedUser.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{selectedUser.name}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500">Select a user...</span>
                  )}
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
                          {availableUsers?.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={() => {
                                setSelectedUserId(user.id)
                                setUserSearchOpen(false)
                                // Set default role if not already set
                                if (!selectedRoleId && defaultRole) {
                                  setSelectedRoleId(defaultRole.id)
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.avatar || undefined} />
                                  <AvatarFallback
                                    className="text-[10px] text-white font-medium"
                                    style={{
                                      backgroundColor: getAvatarColor(user.id || user.name),
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
                              <Check
                                className={cn(
                                  'ml-2 h-4 w-4',
                                  selectedUserId === user.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
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

          {/* Role Selector */}
          <div className="space-y-2">
            <Label className="text-zinc-200">Role</Label>
            <Select
              value={selectedRoleId || ''}
              onValueChange={(value) => setSelectedRoleId(value)}
            >
              <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {rolesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  </div>
                ) : (
                  roles
                    ?.filter((role) => role.name !== 'Owner') // Can't assign Owner role via add
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span>{role.name}</span>
                          {role.description && (
                            <span className="text-xs text-zinc-500 ml-2">{role.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
