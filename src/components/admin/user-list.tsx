'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Trash2,
  Search,
  ArrowUpDown,
  Filter,
  X,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  _count: { projects: number }
}

type SortField = 'name' | 'lastLoginAt' | 'createdAt'
type SortDir = 'asc' | 'desc'
type RoleFilter = 'all' | 'admin' | 'standard'

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  lastLoginAt: 'Last Login',
  createdAt: 'Date Created',
}

export function UserList() {
  const queryClient = useQueryClient()
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  // Filter and sort state
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [minProjects, setMinProjects] = useState('')
  const [maxProjects, setMaxProjects] = useState('')

  // Build query string
  const buildQueryString = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('sortDir', sortDir)
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (minProjects) params.set('minProjects', minProjects)
    if (maxProjects) params.set('maxProjects', maxProjects)
    return params.toString()
  }

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin', 'users', search, sort, sortDir, roleFilter, minProjects, maxProjects],
    queryFn: async () => {
      const queryString = buildQueryString()
      const res = await fetch(`/api/admin/users?${queryString}`)
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasActiveFilters = search || roleFilter !== 'all' || minProjects || maxProjects

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setMinProjects('')
    setMaxProjects('')
  }

  const toggleSortDirection = () => {
    setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
  }

  return (
    <>
      {/* Search and filters toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortLabels[sort]}
                <span className="ml-1 text-zinc-500">({sortDir === 'asc' ? 'A-Z' : 'Z-A'})</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel className="text-zinc-400">Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortField)}>
                <DropdownMenuRadioItem value="name" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="lastLoginAt" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Last Login
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="createdAt" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                  Date Created
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={toggleSortDirection} className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                {sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Role filter */}
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-[140px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                All Users
              </SelectItem>
              <SelectItem value="admin" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                Admins
              </SelectItem>
              <SelectItem value="standard" className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800">
                Standard
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Projects filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 ${
                  minProjects || maxProjects ? 'border-indigo-500' : ''
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Projects
                {(minProjects || maxProjects) && (
                  <Badge variant="secondary" className="ml-2 bg-indigo-500/20 text-indigo-300">
                    {minProjects || '0'}-{maxProjects || '*'}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 p-3 w-[200px]">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Min Projects</label>
                  <Input
                    type="number"
                    min="0"
                    value={minProjects}
                    onChange={(e) => setMinProjects(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Max Projects</label>
                  <Input
                    type="number"
                    min="0"
                    value={maxProjects}
                    onChange={(e) => setMaxProjects(e.target.value)}
                    placeholder="Any"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="text-zinc-400 hover:text-zinc-100"
              title="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Showing {users?.length ?? 0} users</span>
            {search && <Badge variant="outline" className="border-zinc-700 text-zinc-400">Search: {search}</Badge>}
            {roleFilter !== 'all' && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{roleFilter === 'admin' ? 'Admins only' : 'Standard only'}</Badge>}
            {(minProjects || maxProjects) && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                Projects: {minProjects || '0'} - {maxProjects || 'any'}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* User list - scrollable container */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          Failed to load users. Please try again.
        </div>
      ) : !users?.length ? (
        <div className="text-center py-8 text-zinc-500">
          {hasActiveFilters
            ? 'No users match your filters.'
            : 'No users found. Create your first user above.'}
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] space-y-3 pr-1">
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

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-zinc-500">Last login</div>
                    <div className="text-sm text-zinc-400">{formatDate(user.lastLoginAt)}</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-zinc-500">Created</div>
                    <div className="text-sm text-zinc-400">{formatDate(user.createdAt)}</div>
                  </div>
                  <span className="text-sm text-zinc-500 min-w-[80px] text-right">
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
      )}

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
