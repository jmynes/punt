'use client'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
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
import { useDeleteProject, useProjectDetail, useUpdateProject } from '@/hooks/queries/use-projects'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useHasPermission } from '@/hooks/use-permissions'
import { isDemoMode } from '@/lib/demo/demo-config'
import { PERMISSIONS } from '@/lib/permissions'
import { showToast } from '@/lib/toast'

type AddColumnVisibility = 'inherit' | 'show' | 'hide'

function toVisibilityOption(value: boolean | null | undefined): AddColumnVisibility {
  if (value === true) return 'show'
  if (value === false) return 'hide'
  return 'inherit'
}

function fromVisibilityOption(option: AddColumnVisibility): boolean | null {
  if (option === 'show') return true
  if (option === 'hide') return false
  return null
}

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
  const { data: projectDetail } = useProjectDetail(project.key)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)
  const canManageBoard = useHasPermission(projectId, PERMISSIONS.BOARD_MANAGE)
  const canDeleteProject = useHasPermission(projectId, PERMISSIONS.PROJECT_DELETE)

  const [addColumnVisibility, setAddColumnVisibility] = useState<AddColumnVisibility>('inherit')

  const [formData, setFormData] = useState<FormData>({
    name: project.name,
    key: project.key,
    description: project.description || '',
    color: project.color,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteReauth, setShowDeleteReauth] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
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

  // Sync board settings when project detail loads
  useEffect(() => {
    if (projectDetail) {
      setAddColumnVisibility(toVisibilityOption(projectDetail.showAddColumnButton))
    }
  }, [projectDetail])

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

  const handleDeleteConfirmed = useCallback(() => {
    if (!canDeleteProject) return
    setShowDeleteConfirm(false)

    // In demo mode, skip reauth and delete directly
    if (isDemoMode()) {
      deleteProject.mutate(
        { id: project.id },
        {
          onSuccess: () => {
            showToast.success('Project deleted', { description: project.name })
            router.push('/')
          },
          onError: (error) => {
            showToast.error('Failed to delete project', { description: error.message })
          },
        },
      )
    } else {
      setShowDeleteReauth(true)
    }
  }, [canDeleteProject, project.id, project.name, deleteProject, router])

  const handleDeleteWithReauth = useCallback(
    async (password: string, totpCode?: string, isRecoveryCode?: boolean) => {
      if (!canDeleteProject) return

      await deleteProject.mutateAsync(
        {
          id: project.id,
          confirmPassword: password,
          totpCode,
          isRecoveryCode,
        },
        {
          onSuccess: () => {
            showToast.success('Project deleted', { description: project.name })
            router.push('/')
          },
          onError: (error) => {
            throw error
          },
        },
      )
    },
    [canDeleteProject, project.id, project.name, deleteProject, router],
  )

  const handleReset = useCallback(() => {
    setFormData({
      name: project.name,
      key: project.key,
      description: project.description || '',
      color: project.color,
    })
  }, [project])

  const boardSettingsChanged =
    projectDetail && addColumnVisibility !== toVisibilityOption(projectDetail.showAddColumnButton)

  const handleSaveBoardSettings = useCallback(() => {
    if (!canManageBoard) return
    updateProject.mutate({
      id: project.id,
      showAddColumnButton: fromVisibilityOption(addColumnVisibility),
    })
  }, [canManageBoard, project.id, addColumnVisibility, updateProject])

  const handleResetBoardSettings = useCallback(() => {
    if (projectDetail) {
      setAddColumnVisibility(toVisibilityOption(projectDetail.showAddColumnButton))
    }
  }, [projectDetail])

  const isValid = formData.name.trim().length > 0 && formData.key.length > 0
  const isPending = updateProject.isPending || deleteProject.isPending
  const isDisabled = !canEditSettings || isPending

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: hasChanges && isValid && !isDisabled,
  })

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

      {/* Board Settings Card */}
      {canManageBoard && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Board Settings</CardTitle>
            <CardDescription>Configure board behavior for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">&quot;Add Column&quot; button visibility</Label>
              <div className="flex flex-col gap-2">
                {(
                  [
                    {
                      value: 'inherit' as const,
                      label: 'Use global default',
                      description: 'Follow the system-wide setting configured by admins',
                    },
                    {
                      value: 'show' as const,
                      label: 'Always show',
                      description: "Show the Add Column button on this project's board",
                    },
                    {
                      value: 'hide' as const,
                      label: 'Always hide',
                      description: "Hide the Add Column button on this project's board",
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      addColumnVisibility === option.value
                        ? 'border-amber-600/50 bg-amber-950/20'
                        : 'border-zinc-800 hover:border-zinc-700'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="addColumnVisibility"
                      value={option.value}
                      checked={addColumnVisibility === option.value}
                      onChange={() => setAddColumnVisibility(option.value)}
                      disabled={isDisabled}
                      className="mt-1 accent-amber-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{option.label}</p>
                      <p className="text-xs text-zinc-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Save/Reset buttons */}
            {canManageBoard && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleResetBoardSettings}
                  disabled={!boardSettingsChanged || isPending}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveBoardSettings}
                  disabled={!boardSettingsChanged || isPending}
                >
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
      )}

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
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
          if (!open) {
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
                  Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be
                  undone and will remove all associated tickets.
                </p>
                <div className="space-y-2">
                  <p className="text-sm">
                    To confirm, type <span className="font-mono text-red-400">{project.name}</span>{' '}
                    below:
                  </p>
                  <Input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`Type ${project.name} to confirm`}
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
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              disabled={deleteProject.isPending || deleteConfirmText !== project.name}
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password reauthentication dialog */}
      <ReauthDialog
        open={showDeleteReauth}
        onOpenChange={setShowDeleteReauth}
        title="Confirm Project Deletion"
        description={`Enter your password to permanently delete "${project.name}" and all its data.`}
        actionLabel="Delete Project"
        actionVariant="destructive"
        onConfirm={handleDeleteWithReauth}
      />
    </div>
  )
}
