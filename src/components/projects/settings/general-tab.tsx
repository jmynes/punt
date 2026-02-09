'use client'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useDeleteProject, useUpdateProject } from '@/hooks/queries/use-projects'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'

// Preset colors for projects
const PROJECT_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
]

interface GeneralTabProps {
  projectId: string
  project: {
    id: string
    name: string
    key: string
    description: string | null
    color: string
  }
}

interface FormData {
  name: string
  key: string
  description: string
  color: string
}

export function GeneralTab({ projectId, project }: GeneralTabProps) {
  const router = useRouter()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canDeleteProject = useHasPermission(projectId, PERMISSIONS.PROJECT_DELETE)

  const [formData, setFormData] = useState<FormData>({
    name: project.name,
    key: project.key,
    description: project.description || '',
    color: project.color,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const keyChanged = formData.key !== project.key

  // Update form when project data changes
  useEffect(() => {
    setFormData({
      name: project.name,
      key: project.key,
      description: project.description || '',
      color: project.color,
    })
    setHasChanges(false)
  }, [project])

  // Track changes
  useEffect(() => {
    const changed =
      formData.name !== project.name ||
      formData.key !== project.key ||
      formData.description !== (project.description || '') ||
      formData.color !== project.color
    setHasChanges(changed)
  }, [formData, project])

  const handleSave = useCallback(async () => {
    if (!canEditSettings) return

    updateProject.mutate(
      {
        id: project.id,
        name: formData.name.trim(),
        key: keyChanged ? formData.key.toUpperCase() : undefined,
        description: formData.description.trim() || null,
        color: formData.color,
      },
      {
        onSuccess: () => {
          // If key changed, redirect to new URL
          if (keyChanged) {
            router.replace(`/projects/${formData.key.toUpperCase()}/settings`)
          }
        },
      },
    )
  }, [canEditSettings, project.id, formData, keyChanged, updateProject, router])

  const handleDelete = useCallback(async () => {
    if (!canDeleteProject) return

    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success('Project deleted', {
          description: project.name,
        })
        router.push('/')
      },
      onError: (error) => {
        toast.error('Failed to delete project', {
          description: error.message,
        })
      },
    })
    setShowDeleteConfirm(false)
  }, [canDeleteProject, project.id, project.name, deleteProject, router])

  const handleReset = useCallback(() => {
    setFormData({
      name: project.name,
      key: project.key,
      description: project.description || '',
      color: project.color,
    })
  }, [project])

  const isValid = formData.name.trim().length > 0 && formData.key.length > 0
  const isPending = updateProject.isPending || deleteProject.isPending
  const isDisabled = !canEditSettings || isPending

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-zinc-100">General</h3>
        <p className="text-sm text-zinc-500">Manage project details and settings.</p>
      </div>

      {/* Project Details Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Project Details</CardTitle>
          <CardDescription>Basic information about this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-zinc-300">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My Awesome Project"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              disabled={isDisabled}
            />
          </div>

          {/* Project Key */}
          <div className="space-y-2">
            <Label htmlFor="project-key" className="text-zinc-300">
              Project Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-key"
              value={formData.key}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                }))
              }
              maxLength={10}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 uppercase"
              disabled={isDisabled}
            />
            {keyChanged ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-950/30 border border-amber-900/50">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/80">
                  <p className="font-medium text-amber-400 mb-1">
                    Changing the project key will rename all tickets
                  </p>
                  <p>
                    {project.key}-123 → {formData.key}-123
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
            <Label htmlFor="project-description" className="text-zinc-300">
              Description
            </Label>
            <Textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this project..."
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 resize-none"
              rows={3}
              disabled={isDisabled}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Project Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`h-8 w-8 rounded-md transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={isDisabled}
                />
              ))}
            </div>
          </div>

          {/* Save/Reset buttons */}
          {canEditSettings && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || isPending}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || !isValid || isPending}>
                {updateProject.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {canDeleteProject && (
        <>
          <Separator className="bg-zinc-800" />
          <Card className="bg-zinc-900/50 border-red-900/50">
            <CardHeader>
              <CardTitle className="text-base text-red-400">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions for this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Delete this project</p>
                  <p className="text-xs text-zinc-500">
                    Once deleted, this project and all its tickets cannot be recovered.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be
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
    </div>
  )
}
