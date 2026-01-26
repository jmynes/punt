'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  FolderKanban,
  Mail,
  Shield,
  ShieldOff,
  User,
  UserCheck,
  UserX,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getTabId } from '@/hooks/use-realtime'
import { getAvatarColor, getInitials } from '@/lib/utils'

interface ProjectMembership {
  role: {
    name: string
  }
  project: {
    id: string
    name: string
    key: string
    color: string | null
  }
}

interface UserDetails {
  id: string
  email: string | null
  name: string
  avatar: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  projects: ProjectMembership[]
  _count: {
    projects: number
  }
}

export default function AdminUserProfilePage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const userId = params.userId as string

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserDetails>({
    queryKey: ['admin', 'users', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch user')
      }
      return res.json()
    },
  })

  const handleToggleAdmin = async () => {
    if (!user) return

    const newValue = !user.isSystemAdmin
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ isSystemAdmin: newValue }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(
        newValue ? `${user.name} is now an admin` : `${user.name} is no longer an admin`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleToggleActive = async () => {
    if (!user) return

    const newValue = !user.isActive
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ isActive: newValue }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(newValue ? `${user.name} has been enabled` : `${user.name} has been disabled`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-48 bg-zinc-800 rounded" />
            <div className="h-32 bg-zinc-800 rounded-lg" />
            <div className="h-48 bg-zinc-800 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="py-12 text-center">
              <p className="text-zinc-400">
                {error instanceof Error ? error.message : 'User not found'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const updatedDate = new Date(user.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 py-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>

          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-zinc-800">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback
                className="text-2xl font-semibold text-white"
                style={{ backgroundColor: getAvatarColor(user.id) }}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-100">{user.name}</h1>
                {user.isSystemAdmin && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-500/20 text-amber-400 border-amber-500/30"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
                {!user.isActive && (
                  <Badge
                    variant="secondary"
                    className="bg-red-500/20 text-red-400 border-red-500/30"
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </div>
              <p className="text-zinc-400 mt-1">{user.email || 'No email'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6">
        {/* User Info */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">User Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{user.email || 'Not set'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Projects</p>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">
                    {user._count.projects} project{user._count.projects !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Joined</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{createdDate}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">Last Updated</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <p className="text-zinc-200">{updatedDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Projects</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Projects this user has access to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.projects.length === 0 ? (
              <p className="text-zinc-500 text-sm">No project memberships</p>
            ) : (
              <div className="space-y-2">
                {user.projects.map(({ role, project }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}/board`}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white font-semibold text-sm"
                        style={{ backgroundColor: project.color || '#71717a' }}
                      >
                        {project.key.charAt(0)}
                      </div>
                      <div>
                        <p className="text-zinc-100 font-medium">{project.name}</p>
                        <p className="text-zinc-500 text-sm">{project.key}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        role.name === 'owner'
                          ? 'border-amber-500/50 text-amber-400'
                          : role.name === 'admin'
                            ? 'border-blue-500/50 text-blue-400'
                            : 'border-zinc-600 text-zinc-400'
                      }
                    >
                      {role.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Controls */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Admin Controls</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Manage this user's access and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-100">System Administrator</p>
                <p className="text-sm text-zinc-400">
                  {user.isSystemAdmin
                    ? 'Has admin access to manage all users and settings'
                    : 'Standard user without admin privileges'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAdmin}
                className={
                  user.isSystemAdmin
                    ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                    : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
                }
              >
                {user.isSystemAdmin ? (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Remove Admin
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Make Admin
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-100">Account Status</p>
                <p className="text-sm text-zinc-400">
                  {user.isActive
                    ? 'User can sign in and access the system'
                    : 'User is blocked from signing in'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                className={
                  user.isActive
                    ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                    : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                }
              >
                {user.isActive ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Disable User
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Enable User
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
