'use client'

import {
  Bot,
  CalendarClock,
  GitBranch,
  Loader2,
  Settings,
  Shield,
  Tag,
  Users,
  Webhook,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { PageHeader } from '@/components/common'
import { ResponsiveTabs, type TabItem } from '@/components/ui/scrollable-tabs'
import { useHasPermission, useMyPermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'
import { PERMISSIONS } from '@/lib/permissions'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

interface ProjectSettingsShellProps {
  tab: string
  children: React.ReactNode
}

export function ProjectSettingsShell({ tab, children }: ProjectSettingsShellProps) {
  const params = useParams()
  const router = useRouter()

  const projectKey = params.projectId as string
  const { getProjectByKey, isLoading: projectsLoading } = useProjectsStore()
  const project = getProjectByKey(projectKey)
  const projectId = project?.id || projectKey

  const { _hasHydrated } = useBoardStore()
  const { setActiveProjectId } = useUIStore()

  // Permission checks
  const { isLoading: permissionsLoading } = useMyPermissions(projectId)
  const canViewSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canManageMembers = useHasPermission(projectId, PERMISSIONS.MEMBERS_MANAGE)
  const canManageLabels = useHasPermission(projectId, PERMISSIONS.LABELS_MANAGE)
  const canManageRoles = useHasPermission(projectId, PERMISSIONS.MEMBERS_ADMIN)

  // Connect to real-time updates
  useRealtime(projectId, _hasHydrated)

  // Set active project
  useEffect(() => {
    if (_hasHydrated && projectId) {
      setActiveProjectId(projectId)
    }
  }, [_hasHydrated, projectId, setActiveProjectId])

  // Redirect to dashboard if project doesn't exist after hydration
  useEffect(() => {
    if (!projectsLoading && !project) {
      router.replace('/')
    }
  }, [projectsLoading, project, router])

  // Build tabs dynamically based on permissions
  const basePath = `/projects/${projectKey}/settings`
  const tabs: TabItem[] = [
    ...(canViewSettings
      ? [
          {
            value: 'general',
            label: 'General',
            href: `${basePath}/general`,
            icon: <Settings className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canViewSettings
      ? [
          {
            value: 'agents',
            label: 'Agents',
            href: `${basePath}/agents`,
            icon: <Bot className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canViewSettings
      ? [
          {
            value: 'hooks',
            label: 'Hooks',
            href: `${basePath}/hooks`,
            icon: <Webhook className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canManageLabels
      ? [
          {
            value: 'labels',
            label: 'Labels',
            href: `${basePath}/labels`,
            icon: <Tag className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canManageMembers
      ? [
          {
            value: 'members',
            label: 'Members',
            href: `${basePath}/members`,
            icon: <Users className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canViewSettings
      ? [
          {
            value: 'repository',
            label: 'Repository',
            href: `${basePath}/repository`,
            icon: <GitBranch className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canManageRoles
      ? [
          {
            value: 'roles',
            label: 'Roles',
            href: `${basePath}/roles`,
            icon: <Shield className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canViewSettings
      ? [
          {
            value: 'sprints',
            label: 'Sprints',
            href: `${basePath}/sprints`,
            icon: <CalendarClock className="h-4 w-4" />,
          },
        ]
      : []),
  ]

  const tabRoutes = tabs.map((t) => t.href)
  useTabCycleShortcut({ tabs: tabRoutes })

  // Show nothing while redirecting
  if (!projectsLoading && !project) {
    return null
  }

  // Wait for store hydration and permissions to resolve
  if (!_hasHydrated || permissionsLoading || canViewSettings === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="mt-4 text-sm text-zinc-500">Loading settings...</p>
      </div>
    )
  }

  // Check if user has any access to this page
  const hasAnyAccess = canViewSettings || canManageMembers || canManageLabels || canManageRoles

  if (!hasAnyAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Shield className="h-12 w-12 text-zinc-500" />
        <h2 className="mt-4 text-lg font-medium text-zinc-100">Access Denied</h2>
        <p className="mt-2 text-sm text-zinc-500">
          You don&apos;t have permission to view project settings.
        </p>
        <Link
          href={`/projects/${projectKey}/board`}
          className="mt-4 text-sm text-amber-500 hover:text-amber-400"
        >
          Return to Board
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={Settings}
        category={project?.name || projectKey}
        title="Project Settings"
        description="Configure project details, members, labels, and roles"
        variant="hero"
        accentColor="blue"
      />

      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 overflow-hidden">
        <ResponsiveTabs tabs={tabs} activeValue={tab} className="mb-6" />
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
