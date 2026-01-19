'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Shield, ShieldOff, UserX, UserCheck, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  _count: { projects: number }
}

export function UserList() {
  const queryClient = useQueryClient()
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }
      return res.json()
    },
  })

  const updateUser = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string
      updates: Partial<User>
    }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User updated')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteUser = useMutation({
    mutationFn: async ({ userId, permanent }: { userId: string; permanent: boolean }) => {
      const url = permanent
        ? `/api/admin/users/${userId}?permanent=true`
        : `/api/admin/users/${userId}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(data.action === 'deleted' ? 'User permanently deleted' : 'User disabled')
      setDeleteUserId(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const userToDelete = deleteUserId ? users?.find(u => u.id === deleteUserId) : null

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        Failed to load users. Please try again.
      </div>
    )
  }

  if (!users?.length) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No users found. Create your first user above.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="bg-zinc-700 text-zinc-300">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{user.name}</span>
                    {user.isSystemAdmin && (
                      <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs">
                        Admin
                      </Badge>
                    )}
                    {!user.isActive && (
                      <Badge variant="outline" className="border-red-500 text-red-500 text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-zinc-500">{user.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-500">
                  {user._count.projects} project{user._count.projects !== 1 ? 's' : ''}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                    <DropdownMenuItem
                      onClick={() =>
                        updateUser.mutate({
                          userId: user.id,
                          updates: { isSystemAdmin: !user.isSystemAdmin },
                        })
                      }
                      className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
                    >
                      {user.isSystemAdmin ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-2" />
                          Remove admin
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Make admin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem
                      onClick={() =>
                        updateUser.mutate({
                          userId: user.id,
                          updates: { isActive: !user.isActive },
                        })
                      }
                      className={
                        user.isActive
                          ? 'text-red-400 focus:text-red-300 focus:bg-zinc-800'
                          : 'text-green-400 focus:text-green-300 focus:bg-zinc-800'
                      }
                    >
                      {user.isActive ? (
                        <>
                          <UserX className="h-4 w-4 mr-2" />
                          Disable user
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Enable user
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem
                      onClick={() => setDeleteUserId(user.id)}
                      className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete permanently
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to permanently delete <strong className="text-zinc-200">{userToDelete?.name}</strong> ({userToDelete?.email})?
              This action cannot be undone and will remove all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUser.mutate({ userId: deleteUserId, permanent: true })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
