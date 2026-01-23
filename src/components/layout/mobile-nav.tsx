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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDeleteProject } from '@/hooks/queries/use-projects'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'
import { SidebarContent } from './sidebar-content'

export function MobileNav() {
  const currentUser = useCurrentUser()
  const {
    mobileNavOpen,
    setMobileNavOpen,
    activeProjectId,
    setActiveProjectId,
    setCreateProjectOpen,
    openEditProject,
  } = useUIStore()
  const { projects, isLoading } = useProjectsStore()
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)

  const deleteProject = useDeleteProject()

  // Don't render mobile nav when not logged in
  if (!currentUser) {
    return null
  }

  const projectToDelete = deleteProjectId ? projects.find((p) => p.id === deleteProjectId) : null

  const handleDeleteProject = () => {
    if (!deleteProjectId) return
    deleteProject.mutate(deleteProjectId)
    setDeleteProjectId(null)
  }

  const handleLinkClick = () => {
    setMobileNavOpen(false)
  }

  return (
    <>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-80 border-zinc-800 bg-zinc-950 p-0">
          <SheetHeader className="border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <span className="text-sm font-bold">P</span>
              </div>
              <SheetTitle className="text-lg text-white">PUNT</SheetTitle>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-4rem)]">
            <SidebarContent
              currentUser={currentUser}
              projects={projects}
              isLoading={isLoading}
              activeProjectId={activeProjectId}
              onSetActiveProjectId={setActiveProjectId}
              onSetCreateProjectOpen={setCreateProjectOpen}
              onOpenEditProject={openEditProject}
              onDeleteProject={setDeleteProjectId}
              onLinkClick={handleLinkClick}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>

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
