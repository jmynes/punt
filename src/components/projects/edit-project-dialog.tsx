'use client'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDeleteProject, useUpdateProject } from '@/hooks/queries/use-projects'
import { LABEL_COLORS } from '@/lib/constants'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

interface FormData {
  name: string
  key: string
  description: string
  color: string
}

export function EditProjectDialog() {
  const { editProjectOpen, editProjectId, closeEditProject } = useUIStore()
  const { getProject } = useProjectsStore()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const [formData, setFormData] = useState<FormData>({
    name: '',
    key: '',
    description: '',
    color: LABEL_COLORS[0],
  })
  const [originalKey, setOriginalKey] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const keyChanged = formData.key !== originalKey && originalKey !== ''

  // Load project data when dialog opens
  useEffect(() => {
    if (editProjectOpen && editProjectId) {
      const project = getProject(editProjectId)
      if (project) {
        setFormData({
          name: project.name,
          key: project.key,
          description: project.description || '',
          color: project.color,
        })
        setOriginalKey(project.key)
      }
    }
  }, [editProjectOpen, editProjectId, getProject])

  const handleClose = useCallback(() => {
    closeEditProject()
    // Reset form after close animation
    setTimeout(() => {
      setFormData({
        name: '',
        key: '',
        description: '',
        color: LABEL_COLORS[0],
      })
      setOriginalKey('')
    }, 200)
  }, [closeEditProject])

  const handleSubmit = useCallback(async () => {
    if (!editProjectId) return

    // Validate
    if (!formData.name.trim()) {
      return
    }

    updateProject.mutate(
      {
        id: editProjectId,
        name: formData.name.trim(),
        key: keyChanged ? formData.key.toUpperCase() : undefined,
        description: formData.description.trim() || undefined,
        color: formData.color,
      },
      {
        onSuccess: () => {
          const newKey = keyChanged ? formData.key.toUpperCase() : originalKey
          toast.success('Project updated', {
            description: `${formData.name.trim()} (${newKey})`,
            duration: 4000,
          })
          handleClose()
        },
        onError: (error) => {
          toast.error('Failed to update project', {
            description: error.message,
          })
        },
      },
    )
  }, [editProjectId, formData, keyChanged, originalKey, updateProject, handleClose])

  const handleDelete = useCallback(async () => {
    if (!editProjectId) return

    // Get the full project data before deleting
    const project = getProject(editProjectId)
    if (!project) return

    deleteProject.mutate(editProjectId, {
      onSuccess: () => {
        toast.success('Project deleted', {
          description: project.name,
          duration: 4000,
        })
        setShowDeleteConfirm(false)
        handleClose()
      },
      onError: (error) => {
        toast.error('Failed to delete project', {
          description: error.message,
        })
        setShowDeleteConfirm(false)
      },
    })
  }, [editProjectId, getProject, deleteProject, handleClose])

  const isValid = formData.name.trim().length > 0 && formData.key.length > 0
  const isPending = updateProject.isPending || deleteProject.isPending

  return (
    <>
      <Dialog open={editProjectOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Edit Project</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Update project details and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-project-name" className="text-zinc-300">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-project-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="My Awesome Project"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                disabled={isPending}
                autoFocus
              />
            </div>

            {/* Project Key */}
            <div className="space-y-2">
              <Label htmlFor="edit-project-key" className="text-zinc-300">
                Project Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-project-key"
                value={formData.key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  }))
                }
                maxLength={10}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 uppercase"
                disabled={isPending}
              />
              {keyChanged ? (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-950/30 border border-amber-900/50">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/80">
                    <p className="font-medium text-amber-400 mb-1">
                      Changing the project key will rename all tickets
                    </p>
                    <p>
                      {originalKey}-123 → {formData.key}-123
                    </p>
                    <p className="mt-1 text-amber-200/60">
                      External links and bookmarks to existing tickets will break.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  1-10 characters. Used in ticket IDs (e.g., {formData.key}-123)
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-project-description" className="text-zinc-300">
                Description
              </Label>
              <Textarea
                id="edit-project-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this project..."
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 resize-none"
                rows={3}
                disabled={isPending}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Project Color</Label>
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    className={`h-8 w-8 rounded-md transition-all ${
                      formData.color === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    disabled={isPending}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isPending}
              className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400 sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="primary" disabled={!isValid || isPending}>
              {updateProject.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete &quot;{formData.name}&quot;? This action cannot be
              undone and will remove all associated tickets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={deleteProject.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteProject.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
