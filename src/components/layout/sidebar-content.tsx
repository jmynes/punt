'use client'

import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  Database,
  GitBranch,
  Home,
  KeyRound,
  Layers,
  List,
  Mail,
  Palette,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  SlidersHorizontal,
  Tag,
  Target,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useHasAnyPermission, useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/stores/projects-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { UserSummary } from '@/types'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: Home },
  { title: 'Preferences', href: '/preferences', icon: SlidersHorizontal },
]

// Animated collapsible container for smooth expand/collapse
function CollapsibleSection({
  expanded,
  children,
}: {
  expanded: boolean
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>(0)

  // Measure content height whenever content or expansion state changes
  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [])

  useEffect(() => {
    measureHeight()
  }, [measureHeight])

  // Re-measure on every render since children may have changed
  useEffect(measureHeight)

  return (
    <div
      className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
      style={{ maxHeight: expanded ? `${height}px` : '0px' }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

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
  const searchParams = useSearchParams()
  const [editMode, setEditMode] = useState(false)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())
  const [adminExpanded, setAdminExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const { sidebarExpandedSections, toggleSidebarSection } = useSettingsStore()
  const profileExpanded = sidebarExpandedSections.profile ?? false
  const toggleProfileExpanded = useCallback(
    () => toggleSidebarSection('profile'),
    [toggleSidebarSection],
  )
  const adminSettingsExpanded = sidebarExpandedSections.admin ?? false
  const setAdminSettingsExpanded = useCallback(
    (v: boolean) => useSettingsStore.getState().setSidebarSectionExpanded('admin', v),
    [],
  )
  const isProjectSettingsExpanded = useCallback(
    (projectId: string) => sidebarExpandedSections[projectId] ?? false,
    [sidebarExpandedSections],
  )
  const toggleProjectSettingsExpanded = useCallback(
    (projectId: string) => toggleSidebarSection(projectId),
    [toggleSidebarSection],
  )

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
        {/* Profile with collapsible tabs */}
        <div>
          <div className="flex items-center">
            <button
              type="button"
              className="h-9 w-5 shrink-0 flex items-center justify-center text-zinc-500 hover:text-zinc-300 select-none"
              onClick={toggleProfileExpanded}
            >
              {profileExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            <Link href="/profile" onClick={handleLinkClick} className="flex-1 min-w-0">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 pl-1',
                  pathname.startsWith('/profile') && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <User className="h-4 w-4" />
                Profile
              </Button>
            </Link>
          </div>
          <CollapsibleSection expanded={profileExpanded}>
            <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
              <Link href="/profile?tab=profile" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                    pathname === '/profile' &&
                      (searchParams.get('tab') === 'profile' || !searchParams.get('tab')) &&
                      'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <User className="h-3 w-3" />
                  Profile
                </Button>
              </Link>
              <Link href="/profile?tab=security" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                    pathname === '/profile' &&
                      searchParams.get('tab') === 'security' &&
                      'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <KeyRound className="h-3 w-3" />
                  Security
                </Button>
              </Link>
              <Link href="/profile?tab=integrations" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                    pathname === '/profile' &&
                      searchParams.get('tab') === 'integrations' &&
                      'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <Plug className="h-3 w-3" />
                  Integrations
                </Button>
              </Link>
            </div>
          </CollapsibleSection>
        </div>
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
                    pathname.startsWith('/admin/users') && 'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  Users
                </Button>
              </Link>
              <div>
                <div className="flex items-center">
                  <button
                    type="button"
                    className="h-8 w-5 shrink-0 flex items-center justify-center text-zinc-500 hover:text-zinc-300 select-none"
                    onClick={() => setAdminSettingsExpanded(!adminSettingsExpanded)}
                  >
                    {adminSettingsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <Link href="/admin/settings" onClick={handleLinkClick} className="flex-1 min-w-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8 pl-1',
                        pathname === '/admin/settings' && 'bg-zinc-800/50 text-zinc-100',
                      )}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </Link>
                </div>
                <CollapsibleSection expanded={adminSettingsExpanded}>
                  <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
                    <Link href="/admin/settings?tab=email" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            (searchParams.get('tab') === 'email' || !searchParams.get('tab')) &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Mail className="h-3 w-3" />
                        Email
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=branding" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'branding' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Palette className="h-3 w-3" />
                        Branding
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=uploads" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'uploads' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Upload className="h-3 w-3" />
                        File Uploads
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=board" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'board' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Columns3 className="h-3 w-3" />
                        Board
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=roles" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'roles' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Shield className="h-3 w-3" />
                        Default Roles
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=updates" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'updates' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Updates
                      </Button>
                    </Link>
                    <Link href="/admin/settings?tab=database" onClick={handleLinkClick}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                          pathname === '/admin/settings' &&
                            searchParams.get('tab') === 'database' &&
                            'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <Database className="h-3 w-3" />
                        Database
                      </Button>
                    </Link>
                  </div>
                </CollapsibleSection>
              </div>
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
                const isOnProjectPage = pathname.startsWith(`/projects/${project.key}`)
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
                        href={`/projects/${project.key}/board`}
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
                        <Link href={`/projects/${project.key}/backlog`} onClick={handleLinkClick}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                              pathname === `/projects/${project.key}/backlog` &&
                                'bg-zinc-800/50 text-zinc-100',
                            )}
                          >
                            <List className="h-3.5 w-3.5" />
                            Backlog
                          </Button>
                        </Link>
                        <Link href={`/projects/${project.key}/board`} onClick={handleLinkClick}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                              pathname === `/projects/${project.key}/board` &&
                                'bg-zinc-800/50 text-zinc-100',
                            )}
                          >
                            <Layers className="h-3.5 w-3.5" />
                            Board
                          </Button>
                        </Link>
                        <Link href={`/projects/${project.key}/sprints`} onClick={handleLinkClick}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 h-8',
                              pathname === `/projects/${project.key}/sprints` &&
                                'bg-zinc-800/50 text-zinc-100',
                            )}
                          >
                            <Target className="h-3.5 w-3.5" />
                            Sprints
                          </Button>
                        </Link>
                        <ProjectSettingsLink
                          projectId={project.id}
                          projectKey={project.key}
                          pathname={pathname}
                          searchParams={searchParams}
                          expanded={isProjectSettingsExpanded(project.id)}
                          onToggleExpanded={() => toggleProjectSettingsExpanded(project.id)}
                          onClick={handleLinkClick}
                        />
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

// Separate component to handle permission checks for settings link
function ProjectSettingsLink({
  projectId,
  projectKey,
  pathname,
  searchParams,
  expanded,
  onToggleExpanded,
  onClick,
}: {
  projectId: string
  projectKey: string
  pathname: string
  searchParams: ReturnType<typeof useSearchParams>
  expanded: boolean
  onToggleExpanded: () => void
  onClick: () => void
}) {
  // Check if user has any settings-related permissions
  const hasSettingsAccess = useHasAnyPermission(projectId, [
    PERMISSIONS.PROJECT_SETTINGS,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.LABELS_MANAGE,
    PERMISSIONS.MEMBERS_ADMIN,
  ])

  // Check individual permissions for sub-items
  const canViewSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canManageMembers = useHasPermission(projectId, PERMISSIONS.MEMBERS_MANAGE)
  const canManageLabels = useHasPermission(projectId, PERMISSIONS.LABELS_MANAGE)
  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)

  // Don't render if user doesn't have access (or still loading - hide by default)
  if (!hasSettingsAccess) return null

  const isOnSettingsPage = pathname.startsWith(`/projects/${projectKey}/settings`)
  const currentTab = searchParams.get('tab')

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          className="h-8 w-5 shrink-0 flex items-center justify-center text-zinc-500 hover:text-zinc-300 select-none"
          onClick={onToggleExpanded}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          href={`/projects/${projectKey}/settings`}
          onClick={onClick}
          className="flex-1 min-w-0"
        >
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8 pl-1',
              isOnSettingsPage && 'bg-zinc-800/50 text-zinc-100',
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Button>
        </Link>
      </div>
      <CollapsibleSection expanded={expanded}>
        <div className="ml-5 space-y-0.5 border-l border-zinc-800 pl-3 py-1">
          {canViewSettings && (
            <Link href={`/projects/${projectKey}/settings?tab=general`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage &&
                    (currentTab === 'general' || !currentTab) &&
                    'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Settings className="h-3 w-3" />
                General
              </Button>
            </Link>
          )}
          {canManageMembers && (
            <Link href={`/projects/${projectKey}/settings?tab=members`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage && currentTab === 'members' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Users className="h-3 w-3" />
                Members
              </Button>
            </Link>
          )}
          {canManageLabels && (
            <Link href={`/projects/${projectKey}/settings?tab=labels`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage && currentTab === 'labels' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Tag className="h-3 w-3" />
                Labels
              </Button>
            </Link>
          )}
          {canManageRoles && (
            <Link href={`/projects/${projectKey}/settings?tab=roles`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage && currentTab === 'roles' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Shield className="h-3 w-3" />
                Roles
              </Button>
            </Link>
          )}
          {canViewSettings && (
            <Link href={`/projects/${projectKey}/settings?tab=repository`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage && currentTab === 'repository' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <GitBranch className="h-3 w-3" />
                Repository
              </Button>
            </Link>
          )}
          {canViewSettings && (
            <Link href={`/projects/${projectKey}/settings?tab=agents`} onClick={onClick}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-7 text-xs',
                  isOnSettingsPage && currentTab === 'agents' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Bot className="h-3 w-3" />
                Agents
              </Button>
            </Link>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
