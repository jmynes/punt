'use client'

import { useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TypeToConfirmInput } from '@/components/ui/type-to-confirm'
import { useDeleteProject, useProjects } from '@/hooks/queries/use-projects'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtimeProjects } from '@/hooks/use-realtime-projects'
import { isDemoMode } from '@/lib/demo/demo-config'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'
import { SidebarContent } from './sidebar-content'

export function Sidebar() {
  const currentUser = useCurrentUser()
  const {
    sidebarOpen,
    setCreateProjectOpen,
    activeProjectId,
    setActiveProjectId,
    openEditProject,
  } = useUIStore()
  const { projects, isLoading } = useProjectsStore()
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDeleteReauth, setShowDeleteReauth] = useState(false)

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

    // In demo mode, skip reauth and delete directly
    if (isDemoMode()) {
      deleteProject.mutate({ id: deleteProjectId })
      setDeleteProjectId(null)
      setDeleteConfirmText('')
    } else {
      setShowDeleteReauth(true)
    }
  }

  const handleDeleteWithReauth = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    if (!deleteProjectId) return

    await deleteProject.mutateAsync({
      id: deleteProjectId,
      confirmPassword: password,
      totpCode,
      isRecoveryCode,
    })
    setDeleteProjectId(null)
    setDeleteConfirmText('')
  }

  if (!sidebarOpen) {
    return null
  }

  return (
    <>
      <aside className="hidden lg:flex h-full w-72 flex-col border-r border-zinc-800 bg-zinc-950">
        <ScrollArea className="flex-1">
          <SidebarContent
            currentUser={currentUser}
            projects={projects}
            isLoading={isLoading}
            activeProjectId={activeProjectId}
            onSetActiveProjectId={setActiveProjectId}
            onSetCreateProjectOpen={setCreateProjectOpen}
            onOpenEditProject={openEditProject}
            onDeleteProject={setDeleteProjectId}
          />
        </ScrollArea>
      </aside>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteProjectId && !showDeleteReauth}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteProjectId(null)
            setDeleteConfirmText('')
          }
        }}
        title="Delete Project?"
        description={`Are you sure you want to delete "${projectToDelete?.name}"? This action cannot be undone and will remove all associated tickets.`}
        confirmLabel="Delete Project"
        actionVariant="destructive"
        loading={deleteProject.isPending}
        disabled={deleteConfirmText !== projectToDelete?.name}
        onConfirm={handleDeleteProject}
      >
        <TypeToConfirmInput
          requiredText={projectToDelete?.name ?? ''}
          value={deleteConfirmText}
          onChange={setDeleteConfirmText}
          disabled={deleteProject.isPending}
          autoFocus
        />
      </ConfirmDialog>

      {/* Password reauthentication dialog */}
      <ReauthDialog
        open={showDeleteReauth}
        onOpenChange={(open) => {
          setShowDeleteReauth(open)
          if (!open) {
            setDeleteProjectId(null)
            setDeleteConfirmText('')
          }
        }}
        title="Confirm Project Deletion"
        description={`Enter your password to permanently delete "${projectToDelete?.name}" and all its data.`}
        actionLabel="Delete Project"
        actionVariant="destructive"
        onConfirm={handleDeleteWithReauth}
      />
    </>
  )
}
