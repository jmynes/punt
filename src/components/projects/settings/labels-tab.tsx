'use client'

import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  type LabelWithCount,
  useCreateLabel,
  useDeleteLabel,
  useProjectLabelsWithCounts,
  useUpdateLabel,
} from '@/hooks/queries/use-labels'
import { useHasPermission } from '@/hooks/use-permissions'
import { LABEL_COLORS } from '@/lib/constants'
import { PERMISSIONS } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface LabelsTabProps {
  projectId: string
}

export function LabelsTab({ projectId }: LabelsTabProps) {
  const { data: labels, isLoading } = useProjectLabelsWithCounts(projectId)
  const createLabel = useCreateLabel(projectId)
  const updateLabel = useUpdateLabel(projectId)
  const deleteLabel = useDeleteLabel(projectId)

  const canManageLabels = useHasPermission(projectId, PERMISSIONS.LABELS_MANAGE)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0])
  const createInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingLabel, setEditingLabel] = useState<LabelWithCount | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation state
  const [deletingLabel, setDeletingLabel] = useState<LabelWithCount | null>(null)

  // Focus create input when form opens
  useEffect(() => {
    if (showCreateForm) {
      setTimeout(() => createInputRef.current?.focus(), 0)
    }
  }, [showCreateForm])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingLabel) {
      setTimeout(() => editInputRef.current?.focus(), 0)
    }
  }, [editingLabel])

  const handleCreate = useCallback(async () => {
    const name = newLabelName.trim()
    if (!name) return

    createLabel.mutate(
      { name, color: newLabelColor },
      {
        onSuccess: () => {
          toast.success('Label created')
          setNewLabelName('')
          setNewLabelColor(LABEL_COLORS[((labels?.length ?? 0) + 1) % LABEL_COLORS.length])
          setShowCreateForm(false)
        },
      },
    )
  }, [newLabelName, newLabelColor, labels?.length, createLabel])

  const handleStartEdit = useCallback((label: LabelWithCount) => {
    setEditingLabel(label)
    setEditName(label.name)
    setEditColor(label.color)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingLabel(null)
    setEditName('')
    setEditColor('')
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingLabel) return
    const name = editName.trim()
    if (!name) return

    const hasNameChange = name !== editingLabel.name
    const hasColorChange = editColor !== editingLabel.color

    if (!hasNameChange && !hasColorChange) {
      handleCancelEdit()
      return
    }

    updateLabel.mutate(
      {
        labelId: editingLabel.id,
        ...(hasNameChange && { name }),
        ...(hasColorChange && { color: editColor }),
      },
      {
        onSuccess: () => {
          handleCancelEdit()
        },
      },
    )
  }, [editingLabel, editName, editColor, updateLabel, handleCancelEdit])

  const handleDelete = useCallback(async () => {
    if (!deletingLabel) return

    deleteLabel.mutate(deletingLabel.id, {
      onSuccess: () => {
        setDeletingLabel(null)
      },
    })
  }, [deletingLabel, deleteLabel])

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCreate()
      } else if (e.key === 'Escape') {
        setShowCreateForm(false)
        setNewLabelName('')
      }
    },
    [handleCreate],
  )

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSaveEdit()
      } else if (e.key === 'Escape') {
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-100">Labels</h3>
          <p className="text-sm text-zinc-500">
            Manage labels used to categorize and filter tickets in this project.
          </p>
        </div>
        {canManageLabels && !showCreateForm && (
          <Button
            variant="primary"
            onClick={() => {
              setNewLabelColor(LABEL_COLORS[(labels?.length ?? 0) % LABEL_COLORS.length])
              setShowCreateForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Label
          </Button>
        )}
      </div>

      {/* Create Label Form */}
      {showCreateForm && canManageLabels && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">New Label</CardTitle>
            <CardDescription>Choose a name and color for your label.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Preview:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: newLabelColor }}
              >
                {newLabelName || 'Label name'}
              </span>
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <label htmlFor="new-label-name" className="text-sm text-zinc-300">
                Name
              </label>
              <Input
                ref={createInputRef}
                id="new-label-name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="e.g., bug, feature, documentation"
                maxLength={50}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <span className="text-sm text-zinc-300">Color</span>
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    className={cn(
                      'h-7 w-7 rounded-md transition-all',
                      newLabelColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                        : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewLabelName('')
                }}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newLabelName.trim() || createLabel.isPending}
              >
                {createLabel.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Label'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Labels List */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">
            Project Labels
            {labels && labels.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-500">({labels.length})</span>
            )}
          </CardTitle>
          <CardDescription>
            Labels assigned to tickets in this project.{' '}
            {!canManageLabels && 'You need the "Manage labels" permission to edit labels.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!labels || labels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-400">No labels yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                {canManageLabels
                  ? 'Create your first label to start categorizing tickets.'
                  : 'Labels will appear here when they are created.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {labels.map((label) => {
                const isEditing = editingLabel?.id === label.id
                const ticketCount = label._count?.tickets ?? 0

                if (isEditing) {
                  return (
                    <div key={label.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        {/* Color picker for edit */}
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {LABEL_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={cn(
                                  'h-5 w-5 rounded transition-all',
                                  editColor === color
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900'
                                    : 'hover:scale-110',
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Name input and preview */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: editColor }}
                            >
                              {editName || 'Label name'}
                            </span>
                          </div>
                          <Input
                            ref={editInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            maxLength={50}
                            className="bg-zinc-900 border-zinc-700 text-zinc-100 h-8 text-sm"
                          />
                        </div>

                        {/* Save / Cancel */}
                        <div className="flex items-center gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-900/20"
                            onClick={handleSaveEdit}
                            disabled={!editName.trim() || updateLabel.isPending}
                          >
                            {updateLabel.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={label.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Color swatch */}
                      <div
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />

                      {/* Label name as pill */}
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name}
                      </span>

                      {/* Ticket count */}
                      <span className="text-xs text-zinc-500">
                        {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Actions */}
                    {canManageLabels && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                          onClick={() => handleStartEdit(label)}
                          title="Edit label"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                          onClick={() => setDeletingLabel(label)}
                          title="Delete label"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingLabel} onOpenChange={(open) => !open && setDeletingLabel(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Label?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deletingLabel && (
                <>
                  Are you sure you want to delete the label{' '}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: deletingLabel.color }}
                  >
                    {deletingLabel.name}
                  </span>
                  ?
                  {(deletingLabel._count?.tickets ?? 0) > 0 && (
                    <span className="block mt-2 text-amber-400">
                      This label is currently used on {deletingLabel._count?.tickets} ticket
                      {deletingLabel._count?.tickets !== 1 ? 's' : ''}. It will be removed from all
                      of them.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={deleteLabel.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLabel.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLabel.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Label'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
