'use client'

import { Pencil, Settings, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useHasAnyPermission, useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'

interface ProjectContextMenuProps {
  children: ReactNode
  projectId: string
  projectKey: string
  onEditProject: (projectId: string) => void
  onDeleteProject: (projectId: string) => void
  onLinkClick?: () => void
}

export function ProjectContextMenu({
  children,
  projectId,
  projectKey,
  onEditProject,
  onDeleteProject,
  onLinkClick,
}: ProjectContextMenuProps) {
  const router = useRouter()

  const canEditProject = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canDeleteProject = useHasPermission(projectId, PERMISSIONS.PROJECT_DELETE)
  const hasSettingsAccess = useHasAnyPermission(projectId, [
    PERMISSIONS.PROJECT_SETTINGS,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.LABELS_MANAGE,
    PERMISSIONS.MEMBERS_ADMIN,
  ])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {canEditProject && (
          <ContextMenuItem
            onSelect={() => {
              onEditProject(projectId)
              onLinkClick?.()
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit Project
          </ContextMenuItem>
        )}
        {hasSettingsAccess && (
          <ContextMenuItem
            onSelect={() => {
              router.push(`/projects/${projectKey}/settings`)
              onLinkClick?.()
            }}
          >
            <Settings className="h-4 w-4" />
            Project Settings
          </ContextMenuItem>
        )}
        {canDeleteProject && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onSelect={() => {
                onDeleteProject(projectId)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Project
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
