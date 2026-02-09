'use client'

import { Loader2, Settings, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { MembersTab } from '@/components/projects/permissions/members-tab'
import { RolesTab } from '@/components/projects/permissions/roles-tab'
import { GeneralTab } from '@/components/projects/settings/general-tab'
import { useHasPermission, useMyPermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { PERMISSIONS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

type SettingsTab = 'general' | 'members' | 'roles'

const VALID_TABS: SettingsTab[] = ['general', 'members', 'roles']

function isValidTab(tab: string | null): tab is SettingsTab {
  return tab !== null && VALID_TABS.includes(tab as SettingsTab)
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const projectKey = params.projectId as string
  const { getProjectByKey, isLoading: projectsLoading } = useProjectsStore()
  const project = getProjectByKey(projectKey)
  const projectId = project?.id || projectKey

  const { _hasHydrated } = useBoardStore()
  const { setActiveProjectId } = useUIStore()

  // Tab management
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = isValidTab(tabParam) ? tabParam : 'general'

  // Permission checks
  const { isLoading: permissionsLoading } = useMyPermissions(projectId)
  const canViewSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canManageMembers = useHasPermission(projectId, PERMISSIONS.MEMBERS_MANAGE)
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

  // Show nothing while redirecting
  if (!projectsLoading && !project) {
    return null
  }

  // Wait for store hydration and permissions to load
  if (!_hasHydrated || permissionsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="mt-4 text-sm text-zinc-500">Loading settings...</p>
      </div>
    )
  }

  // Check if user has any access to this page (permissions are now loaded)
  const hasAnyAccess = canViewSettings || canManageMembers || canManageRoles

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

  // Determine which tab to show based on permissions
  // If current tab is not accessible, redirect to first accessible tab
  const getEffectiveTab = (): SettingsTab => {
    switch (activeTab) {
      case 'general':
        return canViewSettings ? 'general' : canManageMembers ? 'members' : 'roles'
      case 'members':
        return canManageMembers ? 'members' : canViewSettings ? 'general' : 'roles'
      case 'roles':
        return canManageRoles ? 'roles' : canViewSettings ? 'general' : 'members'
      default:
        return canViewSettings ? 'general' : canManageMembers ? 'members' : 'roles'
    }
  }

  const effectiveTab = getEffectiveTab()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 py-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="h-6 w-6 rounded-md flex-shrink-0"
            style={{ backgroundColor: project?.color || '#3b82f6' }}
          />
          <h1 className="text-2xl font-semibold text-zinc-100">
            {project?.name || projectKey} Settings
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          {canViewSettings && (
            <Link
              href={`/projects/${projectKey}/settings?tab=general`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                effectiveTab === 'general'
                  ? 'text-amber-500 border-amber-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300',
              )}
            >
              <Settings className="h-4 w-4" />
              General
            </Link>
          )}
          {canManageMembers && (
            <Link
              href={`/projects/${projectKey}/settings?tab=members`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                effectiveTab === 'members'
                  ? 'text-amber-500 border-amber-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300',
              )}
            >
              <Users className="h-4 w-4" />
              Members
            </Link>
          )}
          {canManageRoles && (
            <Link
              href={`/projects/${projectKey}/settings?tab=roles`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                effectiveTab === 'roles'
                  ? 'text-amber-500 border-amber-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300',
              )}
            >
              <Shield className="h-4 w-4" />
              Roles
            </Link>
          )}
        </div>

        {/* Tab Content */}
        {effectiveTab === 'general' && project && (
          <GeneralTab
            projectId={projectId}
            project={{
              id: project.id,
              name: project.name,
              key: project.key,
              description: project.description || null,
              color: project.color,
            }}
          />
        )}
        {effectiveTab === 'members' && <MembersTab projectId={projectId} />}
        {effectiveTab === 'roles' && <RolesTab projectId={projectId} />}

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
