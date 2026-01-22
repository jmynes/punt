'use client'

import {
  Check,
  ChevronDown,
  ChevronRight,
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/stores/projects-store'
import type { UserSummary } from '@/types'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: Home },
  { title: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarContentProps {
  currentUser: UserSummary | null
  projects: ProjectSummary[]
  isLoading: boolean
  activeProjectId: string | null
  onSetActiveProjectId: (id: string) => void
  onSetCreateProjectOpen: (open: boolean) => void
  onOpenEditProject: (id: string) => void
  onDeleteProject: (id: string) => void
  onLinkClick?: () => void
}

export function SidebarContent({
  currentUser,
  projects,
  isLoading,
  activeProjectId,
  onSetActiveProjectId,
  onSetCreateProjectOpen,
  onOpenEditProject,
  onDeleteProject,
  onLinkClick,
}: SidebarContentProps) {
  const pathname = usePathname()
  const [editMode, setEditMode] = useState(false)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())
  const [adminExpanded, setAdminExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  // Default all projects to expanded when they load
  useEffect(() => {
    if (projects.length > 0) {
      setExpandedProjectIds((prev) => {
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

  const handleLinkClick = () => {
    onLinkClick?.()
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="px-3 py-4">
      {/* Main navigation */}
      <div className="space-y-1">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href} onClick={handleLinkClick}>
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
            className="flex items-center gap-1 px-3 mb-1 w-full text-left select-none"
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
              <Link href="/admin" onClick={handleLinkClick}>
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
              <Link href="/admin/users" onClick={handleLinkClick}>
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
              <Link href="/admin/settings" onClick={handleLinkClick}>
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
            className="flex items-center gap-1 select-none"
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
              onClick={() => {
                onSetCreateProjectOpen(true)
                handleLinkClick()
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {projectsExpanded && (
          <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
            {isLoading ? (
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
                        className="h-8 w-5 shrink-0 flex items-center justify-center text-zinc-500 hover:text-zinc-300 select-none"
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
                        onClick={() => {
                          onSetActiveProjectId(project.id)
                          handleLinkClick()
                        }}
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
                              onOpenEditProject(project.id)
                              handleLinkClick()
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
                              onDeleteProject(project.id)
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
                        <Link href={`/projects/${project.id}/board`} onClick={handleLinkClick}>
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
                        <Link href={`/projects/${project.id}/backlog`} onClick={handleLinkClick}>
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
                        <Link href={`/projects/${project.id}/sprints`} onClick={handleLinkClick}>
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
    </div>
  )
}
