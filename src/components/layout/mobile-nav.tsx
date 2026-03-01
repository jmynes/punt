'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDeleteProject } from '@/hooks/queries/use-projects'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isDemoMode } from '@/lib/demo/demo-config'
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
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDeleteReauth, setShowDeleteReauth] = useState(false)

  const deleteProject = useDeleteProject()

  // Don't render mobile nav when not logged in
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
        open={!!deleteProjectId && !showDeleteReauth}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteProjectId(null)
            setDeleteConfirmText('')
          }
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-zinc-400">
                <p>
                  Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action
                  cannot be undone and will remove all associated tickets.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-zinc-300">
                    Type{' '}
                    <span className="font-mono font-bold text-red-400">
                      {projectToDelete?.name}
                    </span>{' '}
                    to confirm:
                  </p>
                  <Input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`Type ${projectToDelete?.name} to confirm`}
                    className="bg-zinc-900 border-zinc-700 text-zinc-100"
                    autoComplete="off"
                    disabled={deleteProject.isPending}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={deleteProject.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteProject}
              disabled={deleteProject.isPending || deleteConfirmText !== projectToDelete?.name}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteProject.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
