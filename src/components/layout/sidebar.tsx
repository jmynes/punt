'use client'

import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  Layers,
  List,
  Pencil,
  Plus,
  Settings,
  Shield,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteProject, useProjects } from '@/hooks/queries/use-projects'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtimeProjects } from '@/hooks/use-realtime-projects'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: Home },
  { title: 'Editor Test', href: '/editor-test', icon: FileText },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const currentUser = useCurrentUser()
  const {
    sidebarOpen,
    setCreateProjectOpen,
    activeProjectId,
    setActiveProjectId,
    openEditProject,
  } = useUIStore()
  const { projects, isLoading } = useProjectsStore()
  const [editMode, setEditMode] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())
  const [adminExpanded, setAdminExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  // Default all projects to expanded when they load
  useEffect(() => {
    if (projects.length > 0) {
      setExpandedProjectIds((prev) => {
        // Add any new projects to expanded set (keeps existing expansion state)
        const newSet = new Set(prev)
        for (const project of projects) {
          if (!prev.has(project.id)) {
            newSet.add(project.id)
          }
        }
        return newSet
      })
    }
  }, [projects])

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(projectId)) {
        newSet.delete(projectId)
      } else {
        newSet.add(projectId)
      }
      return newSet
    })
  }

  // Fetch projects from API and sync with store
  useProjects()

  // Subscribe to real-time project events (create/update/delete from other users)
  useRealtimeProjects()

  const deleteProject = useDeleteProject()

  // Don't render sidebar when not logged in
  if (!currentUser) {
    return null
  }

  const projectToDelete = deleteProjectId ? projects.find((p) => p.id === deleteProjectId) : null

  const handleDeleteProject = () => {
    if (!deleteProjectId) return
    deleteProject.mutate(deleteProjectId)
    setDeleteProjectId(null)
  }

  if (!sidebarOpen) {
    return null
  }

  return (
    <>
      <aside className="hidden lg:flex h-[calc(100vh-3.5rem)] w-72 flex-col border-r border-zinc-800 bg-zinc-950">
        <ScrollArea className="flex-1 px-3 py-4">
          {/* Main navigation */}
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                      isActive && 'bg-zinc-800/50 text-zinc-100',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Admin section - only visible to system admins */}
          {currentUser.isSystemAdmin && (
            <div className="mt-6">
              <button
                type="button"
                className="flex items-center gap-1 px-3 mb-1 w-full text-left"
                onClick={() => setAdminExpanded(!adminExpanded)}
              >
                {adminExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Admin
                </span>
              </button>
              {adminExpanded && (
                <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
                  <Link href="/admin">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8',
                        pathname === '/admin' && 'bg-zinc-800/50 text-zinc-100',
                      )}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8',
                        pathname === '/admin/users' && 'bg-zinc-800/50 text-zinc-100',
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Users
                    </Button>
                  </Link>
                  <Link href="/admin/settings">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8',
                        pathname === '/admin/settings' && 'bg-zinc-800/50 text-zinc-100',
                      )}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Projects section */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-1">
              <button
                type="button"
                className="flex items-center gap-1"
                onClick={() => setProjectsExpanded(!projectsExpanded)}
              >
                {projectsExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Projects
                </span>
              </button>
              <div className="flex items-center gap-1">
                {projects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-5 w-5 transition-all duration-200',
                      editMode
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 rounded-sm'
                        : 'text-zinc-500 hover:text-zinc-300',
                    )}
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {projectsExpanded && (
              <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
                {isLoading ? (
                  // Show skeleton while loading from API
                  <>
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                    <Skeleton className="h-8 w-full bg-zinc-800" />
                  </>
                ) : projects.length === 0 ? (
                  <p className="py-2 text-xs text-zinc-500">No projects yet</p>
                ) : (
                  projects.map((project) => {
                    const isActive = activeProjectId === project.id
                    const isExpanded = expandedProjectIds.has(project.id)
                    const isOnProjectPage = pathname.startsWith(`/projects/${project.id}`)
                    return (
                      <div key={project.id}>
                        <div className="relative flex items-center">
                          <button
                            type="button"
                            className="h-8 w-5 shrink-0 flex items-center justify-center text-zinc-500 hover:text-zinc-300"
                            onClick={() => toggleProjectExpanded(project.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <Link
                            href={`/projects/${project.id}/board`}
                            onClick={() => setActiveProjectId(project.id)}
                            className="flex-1 min-w-0"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8 pl-1',
                                (isActive || isOnProjectPage) && 'bg-zinc-800/50 text-zinc-100',
                              )}
                            >
                              <div
                                className="h-3 w-3 rounded-sm shrink-0"
                                style={{ backgroundColor: project.color }}
                              />
                              <span className="truncate">{project.name}</span>
                              {!editMode && (
                                <span className="ml-auto text-xs text-zinc-600 shrink-0">
                                  {project.key}
                                </span>
                              )}
                            </Button>
                          </Link>
                          {editMode && (
                            <div className="absolute right-0 flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  openEditProject(project.id)
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-red-400"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDeleteProjectId(project.id)
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {/* Project sub-nav */}
                        {isExpanded && (
                          <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
                            <Link href={`/projects/${project.id}/board`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                                  pathname === `/projects/${project.id}/board` &&
                                    'bg-zinc-800/50 text-zinc-100',
                                )}
                              >
                                <Layers className="h-3.5 w-3.5" />
                                Board
                              </Button>
                            </Link>
                            <Link href={`/projects/${project.id}/backlog`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                                  pathname === `/projects/${project.id}/backlog` &&
                                    'bg-zinc-800/50 text-zinc-100',
                                )}
                              >
                                <List className="h-3.5 w-3.5" />
                                Backlog
                              </Button>
                            </Link>
                            <Link href={`/projects/${project.id}/sprints`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                                  pathname === `/projects/${project.id}/sprints` &&
                                    'bg-zinc-800/50 text-zinc-100',
                                )}
                              >
                                <Target className="h-3.5 w-3.5" />
                                Sprints
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom section */}
        <div className="border-t border-zinc-800 p-3">
          <Link href="/settings">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                pathname === '/settings' && 'bg-zinc-800/50 text-zinc-100',
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This will remove
              the project and all its tickets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
