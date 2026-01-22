'use client'

import { useState } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDeleteProject, useProjects } from '@/hooks/queries/use-projects'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtimeProjects } from '@/hooks/use-realtime-projects'
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
