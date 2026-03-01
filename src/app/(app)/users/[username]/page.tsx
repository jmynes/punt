'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Loader2,
  Mail,
  Plus,
  Settings,
  Shield,
  ShieldOff,
  User,
  UserCheck,
  UserMinus,
  UserX,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser, useIsSystemAdmin } from '@/hooks/use-current-user'
import { getTabId } from '@/hooks/use-realtime'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'
import { showToast } from '@/lib/toast'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { type MemberSnapshot, useAdminUndoStore } from '@/stores/admin-undo-store'

// ============================================================================
// Types
// ============================================================================

interface ProjectRole {
  id: string
  name: string
  position: number
}

interface ProjectMembership {
  id: string
  roleId: string
  role: {
    id: string
    name: string
  }
  project: {
    id: string
    name: string
    key: string
    color: string | null
    roles?: ProjectRole[]
  }
}

interface UserDetails {
  id: string
  username: string
  email: string | null
  name: string
  avatar: string | null
  avatarColor: string | null
  isSystemAdmin: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  projects: ProjectMembership[]
  _count: {
    projects: number
  }
  isSelf: boolean
  isViewerAdmin: boolean
}

interface AvailableProject {
  id: string
  name: string
  key: string
  color: string | null
  roles: ProjectRole[]
}

type ProfileTabType = 'projects' | 'admin'

// ============================================================================
// Sub-components
// ============================================================================

function RoleSelector({
  membership,
  onRoleChange,
}: {
  membership: ProjectMembership
  onRoleChange: (roleId: string, roleName: string) => void
}) {
  const [open, setOpen] = useState(false)

  const getRoleStyle = (roleName: string) => {
    switch (roleName) {
      case 'Owner':
        return 'border-amber-500/50 text-amber-400'
      case 'Admin':
        return 'border-blue-500/50 text-blue-400'
      default:
        return 'border-zinc-600 text-zinc-400'
    }
  }

  const roles = membership.project.roles ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-[110px] justify-between font-normal',
            getRoleStyle(membership.role.name),
          )}
        >
          {membership.role.name}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="end">
        <Command>
          <CommandList>
            <CommandEmpty>No roles found</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => {
                    if (role.id !== membership.roleId) {
                      onRoleChange(role.id, role.name)
                    }
                    setOpen(false)
                  }}
                  className={cn(
                    'cursor-pointer',
                    role.name === 'Owner' && 'text-amber-400',
                    role.name === 'Admin' && 'text-blue-400',
                    role.name === 'Member' && 'text-zinc-400',
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      membership.roleId === role.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function RoleBadge({ roleName }: { roleName: string }) {
  const getRoleStyle = (name: string) => {
    switch (name) {
      case 'Owner':
        return 'border-amber-500/50 text-amber-400 bg-amber-500/10'
      case 'Admin':
        return 'border-blue-500/50 text-blue-400 bg-blue-500/10'
      default:
        return 'border-zinc-600 text-zinc-400 bg-zinc-800/50'
    }
  }

  return (
    <Badge variant="outline" className={cn('w-[110px] justify-center', getRoleStyle(roleName))}>
      {roleName}
    </Badge>
  )
}

function AddToProjectDialog({
  userId,
  userName,
  username,
  onAdded,
}: {
  userId: string
  userName: string
  username: string
  onAdded: (snapshot: MemberSnapshot) => void
}) {
  const [open, setOpen] = useState(false)
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<AvailableProject | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const { data: availableProjects, isLoading: projectsLoading } = useQuery<AvailableProject[]>({
    queryKey: ['admin', 'user', username, 'available-projects'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${username}/available-projects`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch available projects')
      }
      return res.json()
    },
    enabled: open,
  })

  const filteredProjects = useMemo(() => {
    if (!availableProjects) return []
    if (!search.trim()) return availableProjects
    const searchLower = search.toLowerCase()
    return availableProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) || p.key.toLowerCase().includes(searchLower),
    )
  }, [availableProjects, search])

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearch('')
      setSelectedProject(null)
      setSelectedRoleId('')
    }
  }, [])

  const handleSelectProject = (project: AvailableProject) => {
    setSelectedProject(project)
    const defaultRole =
      project.roles.find((r) => r.name === 'Member') ??
      project.roles.find((r) => r.name !== 'Owner')
    setSelectedRoleId(defaultRole?.id ?? project.roles[0]?.id ?? '')
    setProjectSearchOpen(false)
    setSearch('')
  }

  const handleSubmit = async () => {
    if (!selectedProject || !selectedRoleId) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${selectedProject.key}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ userId, roleId: selectedRoleId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add member')
      }

      const data = await res.json()
      const roleName = selectedProject.roles.find((r) => r.id === selectedRoleId)?.name ?? 'Member'

      queryClient.invalidateQueries({ queryKey: ['user', username] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user', username, 'available-projects'],
      })

      onAdded({
        membershipId: data.id,
        projectId: selectedProject.id,
        userId,
        userName,
        roleId: selectedRoleId,
        roleName,
      })

      showToast.success(
        `Added ${userName} to ${selectedProject.name} as ${roleName} (Ctrl+Z to undo)`,
      )
      handleOpenChange(false)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to add to project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add to Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Project</DialogTitle>
          <DialogDescription>Add {userName} to a project with a specific role.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <span className="text-sm font-medium text-zinc-200">Project</span>
            <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectSearchOpen}
                  className="w-full justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                >
                  {selectedProject ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded shrink-0"
                        style={{ backgroundColor: selectedProject.color || '#71717a' }}
                      />
                      <span>{selectedProject.name}</span>
                      <span className="text-zinc-500">({selectedProject.key})</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500">Select a project...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search projects..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    {projectsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>
                          {availableProjects?.length === 0
                            ? 'User is already a member of all projects.'
                            : 'No projects found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredProjects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.id}
                              onSelect={() => handleSelectProject(project)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className="w-6 h-6 rounded flex items-center justify-center text-white font-semibold text-xs shrink-0"
                                  style={{ backgroundColor: project.color || '#71717a' }}
                                >
                                  {project.key.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm">{project.name}</p>
                                  <p className="truncate text-xs text-zinc-400">{project.key}</p>
                                </div>
                              </div>
                              <Check
                                className={cn(
                                  'ml-2 h-4 w-4',
                                  selectedProject?.id === project.id ? 'opacity-100' : 'opacity-0',
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

          {selectedProject && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-zinc-200">Role</span>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedProject.roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            disabled={!selectedProject || !selectedRoleId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add to Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Projects Card (shared between self and admin views)
// ============================================================================

function ProjectsCard({
  user,
  isViewerAdmin,
  onRoleChange,
  onRemoveMember,
}: {
  user: UserDetails
  isViewerAdmin: boolean
  onRoleChange?: (
    membershipId: string,
    projectId: string,
    newRoleId: string,
    newRoleName: string,
  ) => void
  onRemoveMember?: (membership: ProjectMembership) => void
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">Projects</CardTitle>
            </div>
            <CardDescription className="text-zinc-500 mt-1">
              {user.isSelf ? 'Projects you have access to' : 'Projects this user has access to'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {user.projects.length === 0 ? (
          <p className="text-zinc-500 text-sm">No project memberships</p>
        ) : (
          <div className="space-y-2">
            {user.projects.map((membership) => (
              <div
                key={membership.id}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
              >
                <Link
                  href={`/projects/${membership.project.key}/board`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: membership.project.color || '#71717a' }}
                  >
                    {membership.project.key.charAt(0)}
                  </div>
                  <div>
                    <p className="text-zinc-100 font-medium">{membership.project.name}</p>
                    <p className="text-zinc-500 text-sm">{membership.project.key}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {isViewerAdmin && onRoleChange && onRemoveMember ? (
                    <>
                      <RoleSelector
                        membership={membership}
                        onRoleChange={(newRoleId, newRoleName) =>
                          onRoleChange(membership.id, membership.project.id, newRoleId, newRoleName)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                        title="Remove from project"
                        onClick={() => onRemoveMember(membership)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        className="text-zinc-500 hover:text-zinc-200"
                        title="Edit project roles"
                      >
                        <Link href={`/projects/${membership.project.key}/settings?tab=roles`}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <RoleBadge roleName={membership.role.name} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Admin Controls Card
// ============================================================================

function AdminControlsCard({
  user,
  onToggleAdmin,
  onToggleActive,
}: {
  user: UserDetails
  onToggleAdmin: () => void
  onToggleActive: () => void
}) {
  return (
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
            <p className="font-medium text-zinc-100">Super Admin</p>
            <p className="text-sm text-zinc-400">
              {user.isSystemAdmin
                ? 'Has full access to manage all users and settings'
                : 'Standard user without super admin privileges'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAdmin}
            className={
              user.isSystemAdmin
                ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
            }
          >
            {user.isSystemAdmin ? (
              <>
                <ShieldOff className="h-4 w-4 mr-2" />
                Remove Super Admin
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Make Super Admin
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
            onClick={onToggleActive}
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
  )
}

// ============================================================================
// Loading State
// ============================================================================

function ProfileLoading() {
  return (
    <div className="h-full overflow-auto bg-zinc-950">
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

// ============================================================================
// Main Content Component
// ============================================================================

function UserProfileContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const username = params.username as string
  const currentUser = useCurrentUser()
  const { isLoading: isAdminLoading } = useIsSystemAdmin()
  const { pushMemberRoleChange, pushMemberAdd, pushMemberRemove, undo, redo, canUndo, canRedo } =
    useAdminUndoStore()

  // Fetch user data from unified API
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserDetails>({
    queryKey: ['user', username],
    queryFn: async () => {
      const res = await fetch(`/api/users/${username}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch user')
      }
      return res.json()
    },
    enabled: !!currentUser,
  })

  const fromAdmin = searchParams.get('from') != null
  const isSelf = (user?.isSelf ?? false) && !fromAdmin
  const isViewerAdmin = user?.isViewerAdmin ?? false

  // Tab management (for self-view)
  const SELF_TABS: ProfileTabType[] = isViewerAdmin ? ['projects', 'admin'] : ['projects']

  const tabParam = searchParams.get('tab')
  const activeTab: ProfileTabType =
    tabParam && SELF_TABS.includes(tabParam as ProfileTabType)
      ? (tabParam as ProfileTabType)
      : 'projects'

  // Tab cycling keyboard shortcut (for self-view)
  useTabCycleShortcut({
    tabs: isSelf ? SELF_TABS : [],
    queryBasePath: `/users/${username}`,
  })

  // State for dialogs
  const [removingMembership, setRemovingMembership] = useState<ProjectMembership | null>(null)
  const [showAdminReauthDialog, setShowAdminReauthDialog] = useState(false)
  const [showActiveReauthDialog, setShowActiveReauthDialog] = useState(false)

  // Navigation context from query params
  const navContext = useMemo(() => {
    const from = searchParams.get('from')
    const projectKey = searchParams.get('projectKey')
    const tab = searchParams.get('tab')

    if (from === 'admin-users') {
      return { href: '/admin/users', label: 'Back to Users' }
    }
    if (from === 'project-settings' && projectKey) {
      return {
        href: `/projects/${projectKey}/settings?tab=${tab ?? 'members'}`,
        label: 'Back to Project Settings',
      }
    }
    return null
  }, [searchParams])

  // Helper to invalidate user-related queries
  const invalidateUserQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user', username] })
    queryClient.invalidateQueries({
      queryKey: ['admin', 'user', username, 'available-projects'],
    })
  }, [queryClient, username])

  // Helper to perform role change API call
  const performRoleChange = useCallback(
    async (
      membershipId: string,
      projectId: string,
      roleId: string,
      roleName: string,
      isUndo = false,
    ) => {
      const res = await fetch(`/api/projects/${projectId}/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ roleId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      invalidateUserQueries()
      showToast.success(isUndo ? `Role reverted to ${roleName}` : `Role updated to ${roleName}`)
    },
    [invalidateUserQueries],
  )

  // Helper to add a member to a project
  const performAddMember = useCallback(
    async (projectId: string, userId: string, roleId: string) => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ userId, roleId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add member')
      }
      return res.json()
    },
    [],
  )

  // Helper to remove a member from a project
  const performRemoveMember = useCallback(async (projectId: string, membershipId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members/${membershipId}`, {
      method: 'DELETE',
      headers: { 'X-Tab-Id': getTabId() },
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to remove member')
    }
  }, [])

  // Handle undo
  const handleUndo = useCallback(async () => {
    const action = undo()
    if (!action) return

    if (action.type === 'memberRoleChange') {
      try {
        await performRoleChange(
          action.member.membershipId,
          action.member.projectId,
          action.member.previousRoleId,
          action.member.previousRoleName,
          true,
        )
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to undo')
        pushMemberRoleChange(action.member)
      }
    } else if (action.type === 'memberAdd') {
      try {
        for (const member of action.members) {
          const currentUserData = queryClient.getQueryData<UserDetails>(['user', username])
          const currentMembership = currentUserData?.projects.find(
            (p) => p.project.id === member.projectId,
          )
          if (currentMembership) {
            await performRemoveMember(member.projectId, currentMembership.id)
          }
        }
        invalidateUserQueries()
        showToast.success('Membership removed (undo)')
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to undo')
      }
    } else if (action.type === 'memberRemove') {
      try {
        for (const member of action.members) {
          await performAddMember(member.projectId, member.userId, member.roleId)
        }
        invalidateUserQueries()
        showToast.success('Membership restored (undo)')
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to undo')
      }
    }
  }, [
    undo,
    performRoleChange,
    pushMemberRoleChange,
    performAddMember,
    performRemoveMember,
    invalidateUserQueries,
    queryClient,
    username,
  ])

  // Handle redo
  const handleRedo = useCallback(async () => {
    const action = redo()
    if (!action) return

    if (action.type === 'memberRoleChange') {
      try {
        await performRoleChange(
          action.member.membershipId,
          action.member.projectId,
          action.member.newRoleId,
          action.member.newRoleName,
          false,
        )
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to redo')
      }
    } else if (action.type === 'memberAdd') {
      try {
        for (const member of action.members) {
          await performAddMember(member.projectId, member.userId, member.roleId)
        }
        invalidateUserQueries()
        showToast.success('Member re-added to project')
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to redo')
      }
    } else if (action.type === 'memberRemove') {
      try {
        for (const member of action.members) {
          const currentUserData = queryClient.getQueryData<UserDetails>(['user', username])
          const currentMembership = currentUserData?.projects.find(
            (p) => p.project.id === member.projectId,
          )
          if (currentMembership) {
            await performRemoveMember(member.projectId, currentMembership.id)
          }
        }
        invalidateUserQueries()
        showToast.success('Membership removed')
      } catch (err) {
        showToast.error(err instanceof Error ? err.message : 'Failed to redo')
      }
    }
  }, [
    redo,
    performRoleChange,
    performAddMember,
    performRemoveMember,
    invalidateUserQueries,
    queryClient,
    username,
  ])

  // Keyboard shortcuts for undo/redo (only when admin controls are visible)
  useEffect(() => {
    if (!isViewerAdmin) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) handleUndo()
      } else if (modKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo()) handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isViewerAdmin, canUndo, canRedo, handleUndo, handleRedo])

  const handleToggleAdmin = async (
    confirmPassword: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    if (!user) return

    const newValue = !user.isSystemAdmin
    const previousUser = user

    queryClient.setQueryData<UserDetails>(['user', username], (old) =>
      old ? { ...old, isSystemAdmin: newValue } : old,
    )

    try {
      const res = await fetch(`/api/admin/users/${username}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({
          isSystemAdmin: newValue,
          confirmPassword,
          totpCode,
          isRecoveryCode,
        }),
      })

      if (!res.ok) {
        queryClient.setQueryData(['user', username], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      queryClient.setQueriesData<Array<{ id: string; isSystemAdmin?: boolean }>>(
        { queryKey: ['admin', 'users'], exact: true },
        (oldData) => {
          if (!oldData || !Array.isArray(oldData)) return oldData
          return oldData.map((u) => (u.id === user.id ? { ...u, isSystemAdmin: newValue } : u))
        },
      )

      invalidateUserQueries()

      showToast.success(
        newValue ? `${user.name} is now an admin` : `${user.name} is no longer an admin`,
      )
    } catch (err) {
      queryClient.setQueryData(['user', username], previousUser)
      throw err
    }
  }

  const handleToggleActive = async (
    confirmPassword: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    if (!user) return

    const newValue = !user.isActive
    const previousUser = user

    queryClient.setQueryData<UserDetails>(['user', username], (old) =>
      old ? { ...old, isActive: newValue } : old,
    )

    try {
      const res = await fetch(`/api/admin/users/${username}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ isActive: newValue, confirmPassword, totpCode, isRecoveryCode }),
      })

      if (!res.ok) {
        queryClient.setQueryData(['user', username], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }

      queryClient.setQueriesData<Array<{ id: string; isActive?: boolean }>>(
        { queryKey: ['admin', 'users'], exact: true },
        (oldData) => {
          if (!oldData || !Array.isArray(oldData)) return oldData
          return oldData.map((u) => (u.id === user.id ? { ...u, isActive: newValue } : u))
        },
      )

      showToast.success(
        newValue ? `${user.name} has been enabled` : `${user.name} has been disabled`,
      )
    } catch (err) {
      queryClient.setQueryData(['user', username], previousUser)
      throw err
    }
  }

  const handleRoleChange = async (
    membershipId: string,
    projectId: string,
    newRoleId: string,
    newRoleName: string,
  ) => {
    if (!user) return

    const previousUser = user
    const membership = user.projects.find((p) => p.id === membershipId)
    if (!membership || membership.roleId === newRoleId) return

    const previousRoleId = membership.roleId
    const previousRoleName = membership.role.name

    queryClient.setQueryData<UserDetails>(['user', username], (old) => {
      if (!old) return old
      return {
        ...old,
        projects: old.projects.map((p) =>
          p.id === membershipId
            ? { ...p, roleId: newRoleId, role: { ...p.role, id: newRoleId, name: newRoleName } }
            : p,
        ),
      }
    })

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ roleId: newRoleId }),
      })

      if (!res.ok) {
        queryClient.setQueryData(['user', username], previousUser)
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      pushMemberRoleChange({
        membershipId,
        projectId,
        targetUserId: user.id,
        userName: user.name,
        previousRoleId,
        previousRoleName,
        newRoleId,
        newRoleName,
      })

      showToast.withUndo(`Role updated to ${newRoleName}`, {
        onUndo: handleUndo,
      })
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleMemberAdded = useCallback(
    (snapshot: MemberSnapshot) => {
      pushMemberAdd(snapshot.projectId, [snapshot])
    },
    [pushMemberAdd],
  )

  const handleRemoveMember = async () => {
    if (!removingMembership || !user) return

    const membership = removingMembership
    const memberSnapshot: MemberSnapshot = {
      membershipId: membership.id,
      projectId: membership.project.id,
      userId: user.id,
      userName: user.name,
      roleId: membership.roleId,
      roleName: membership.role.name,
    }

    queryClient.setQueryData<UserDetails>(['user', username], (old) => {
      if (!old) return old
      return {
        ...old,
        projects: old.projects.filter((p) => p.id !== membership.id),
        _count: { ...old._count, projects: old._count.projects - 1 },
      }
    })

    setRemovingMembership(null)

    try {
      const res = await fetch(`/api/projects/${membership.project.key}/members/${membership.id}`, {
        method: 'DELETE',
        headers: { 'X-Tab-Id': getTabId() },
      })

      if (!res.ok) {
        invalidateUserQueries()
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      queryClient.invalidateQueries({
        queryKey: ['admin', 'user', username, 'available-projects'],
      })

      pushMemberRemove(membership.project.id, [memberSnapshot])

      showToast.success(`Removed from ${membership.project.name} (Ctrl+Z to undo)`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to remove from project')
    }
  }

  // Redirect non-admin users trying to view someone else
  useEffect(() => {
    if (!isLoading && !isAdminLoading && user && !user.isSelf && !user.isViewerAdmin) {
      router.replace('/')
    }
  }, [isLoading, isAdminLoading, user, router])

  // Loading state
  if (isLoading || isAdminLoading) {
    return <ProfileLoading />
  }

  if (error || !user) {
    return (
      <div className="h-full overflow-auto bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {navContext && (
            <Button variant="ghost" asChild className="mb-6">
              <Link href={navContext.href}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {navContext.label}
              </Link>
            </Button>
          )}
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

  // Self-view: hero header + tabs
  if (isSelf) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Hero Header */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />

          <div className="relative max-w-3xl mx-auto px-6 py-8">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 ring-4 ring-zinc-800">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback
                  className="text-2xl font-semibold text-white"
                  style={{ backgroundColor: user.avatarColor || getAvatarColor(user.id) }}
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
                      Super Admin
                    </Badge>
                  )}
                </div>
                <p className="text-zinc-400 mt-1">{user.email || 'No email'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-3xl px-6 pt-6 overflow-auto">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-6 border-b border-zinc-800">
            <Link
              href={`/users/${username}?tab=projects`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === 'projects'
                  ? 'text-amber-500 border-amber-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300',
              )}
            >
              <FolderKanban className="h-4 w-4" />
              Projects
            </Link>
            {isViewerAdmin && (
              <Link
                href={`/users/${username}?tab=admin`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === 'admin'
                    ? 'text-amber-500 border-amber-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-300',
                )}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'projects' && (
              <div className="pb-8">
                <ProjectsCard user={user} isViewerAdmin={false} />
              </div>
            )}
            {activeTab === 'admin' && isViewerAdmin && (
              <div className="space-y-6 pb-8">
                <AdminControlsCard
                  user={user}
                  onToggleAdmin={() => setShowAdminReauthDialog(true)}
                  onToggleActive={() => setShowActiveReauthDialog(true)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="h-6 flex-shrink-0" />

        {/* Reauth Dialogs */}
        <ReauthDialog
          open={showAdminReauthDialog}
          onOpenChange={setShowAdminReauthDialog}
          title={user.isSystemAdmin ? 'Confirm Remove Admin' : 'Confirm Make Admin'}
          description={
            user.isSystemAdmin
              ? `Remove super admin privileges from ${user.name}?`
              : `Grant super admin privileges to ${user.name}? They will have full access to manage all users and settings.`
          }
          actionLabel={user.isSystemAdmin ? 'Remove Admin' : 'Make Admin'}
          actionVariant={user.isSystemAdmin ? 'destructive' : 'default'}
          onConfirm={handleToggleAdmin}
        />

        <ReauthDialog
          open={showActiveReauthDialog}
          onOpenChange={setShowActiveReauthDialog}
          title={user.isActive ? 'Confirm Disable User' : 'Confirm Enable User'}
          description={
            user.isActive
              ? `Disable ${user.name}? They will be blocked from signing in.`
              : `Enable ${user.name}? They will be able to sign in again.`
          }
          actionLabel={user.isActive ? 'Disable User' : 'Enable User'}
          actionVariant={user.isActive ? 'destructive' : 'default'}
          onConfirm={handleToggleActive}
        />
      </div>
    )
  }

  // Admin viewing another user: hero header + cards
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
    <div className="h-full overflow-auto bg-zinc-950">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 py-8">
          {navContext && (
            <Button variant="ghost" asChild className="mb-4 -ml-2">
              <Link href={navContext.href}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {navContext.label}
              </Link>
            </Button>
          )}

          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-zinc-800">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback
                className="text-2xl font-semibold text-white"
                style={{ backgroundColor: user.avatarColor || getAvatarColor(user.id) }}
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
                    Super Admin
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

      <div className="max-w-3xl mx-auto px-6 pt-6 pb-16 space-y-6">
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

        {/* Projects with admin editing */}
        <div className="relative">
          {isViewerAdmin && (
            <div className="absolute top-4 right-6 z-10">
              <AddToProjectDialog
                userId={user.id}
                userName={user.name}
                username={username}
                onAdded={handleMemberAdded}
              />
            </div>
          )}
          <ProjectsCard
            user={user}
            isViewerAdmin={isViewerAdmin}
            onRoleChange={handleRoleChange}
            onRemoveMember={setRemovingMembership}
          />
        </div>

        {/* Admin Controls */}
        {isViewerAdmin && (
          <AdminControlsCard
            user={user}
            onToggleAdmin={() => setShowAdminReauthDialog(true)}
            onToggleActive={() => setShowActiveReauthDialog(true)}
          />
        )}
      </div>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog
        open={!!removingMembership}
        onOpenChange={(open) => !open && setRemovingMembership(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {user.name} from{' '}
              <span className="font-medium text-zinc-300">{removingMembership?.project.name}</span>?
              They will lose access to all project resources.
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

      {/* Reauth Dialogs */}
      <ReauthDialog
        open={showAdminReauthDialog}
        onOpenChange={setShowAdminReauthDialog}
        title={user.isSystemAdmin ? 'Confirm Remove Admin' : 'Confirm Make Admin'}
        description={
          user.isSystemAdmin
            ? `Remove super admin privileges from ${user.name}?`
            : `Grant super admin privileges to ${user.name}? They will have full access to manage all users and settings.`
        }
        actionLabel={user.isSystemAdmin ? 'Remove Admin' : 'Make Admin'}
        actionVariant={user.isSystemAdmin ? 'destructive' : 'default'}
        onConfirm={handleToggleAdmin}
      />

      <ReauthDialog
        open={showActiveReauthDialog}
        onOpenChange={setShowActiveReauthDialog}
        title={user.isActive ? 'Confirm Disable User' : 'Confirm Enable User'}
        description={
          user.isActive
            ? `Disable ${user.name}? They will be blocked from signing in.`
            : `Enable ${user.name}? They will be able to sign in again.`
        }
        actionLabel={user.isActive ? 'Disable User' : 'Enable User'}
        actionVariant={user.isActive ? 'destructive' : 'default'}
        onConfirm={handleToggleActive}
      />
    </div>
  )
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <UserProfileContent />
    </Suspense>
  )
}
