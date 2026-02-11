'use client'

import { Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ColorPickerBody } from '@/components/tickets/label-select'
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
import { ScrollArea } from '@/components/ui/scroll-area'
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

  // Selection state
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Editor form state
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0])
  const [hasChanges, setHasChanges] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation state
  const [deletingLabel, setDeletingLabel] = useState<LabelWithCount | null>(null)

  // Get the currently selected label
  const selectedLabel = labels?.find((l) => l.id === selectedLabelId) ?? null

  // Load label data into the editor
  const loadLabelData = useCallback((label: LabelWithCount) => {
    setEditName(label.name)
    setEditColor(label.color)
    setHasChanges(false)
  }, [])

  // Select the first label by default when labels load
  useEffect(() => {
    if (labels && labels.length > 0 && !selectedLabelId && !isCreating) {
      setSelectedLabelId(labels[0].id)
      loadLabelData(labels[0])
    }
  }, [labels, selectedLabelId, isCreating, loadLabelData])

  // Handle label selection
  const handleSelectLabel = useCallback(
    (label: LabelWithCount) => {
      if (label.id === selectedLabelId && !isCreating) return
      setSelectedLabelId(label.id)
      setIsCreating(false)
      loadLabelData(label)
    },
    [selectedLabelId, isCreating, loadLabelData],
  )

  // Handle starting create mode
  const handleStartCreate = useCallback(() => {
    const nextColor = LABEL_COLORS[(labels?.length ?? 0) % LABEL_COLORS.length]
    setIsCreating(true)
    setSelectedLabelId(null)
    setEditName('')
    setEditColor(nextColor)
    setHasChanges(false)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [labels?.length])

  // Derive hasChanges reactively from current state
  useEffect(() => {
    if (isCreating) {
      setHasChanges(editName.trim() !== '')
    } else if (selectedLabel) {
      setHasChanges(editName !== selectedLabel.name || editColor !== selectedLabel.color)
    } else {
      setHasChanges(false)
    }
  }, [editName, editColor, isCreating, selectedLabel])

  // Handle field changes
  const handleNameChange = useCallback((value: string) => {
    setEditName(value)
  }, [])

  const handleColorChange = useCallback((value: string) => {
    setEditColor(value)
  }, [])

  // Save changes (create or update)
  const handleSave = useCallback(async () => {
    const name = editName.trim()
    if (!name) {
      toast.error('Label name is required')
      return
    }

    if (isCreating) {
      createLabel.mutate(
        { name, color: editColor },
        {
          onSuccess: (newLabel) => {
            toast.success('Label created')
            setIsCreating(false)
            setSelectedLabelId(newLabel.id)
            setHasChanges(false)
          },
        },
      )
    } else if (selectedLabel) {
      const hasNameChange = name !== selectedLabel.name
      const hasColorChange = editColor !== selectedLabel.color

      if (!hasNameChange && !hasColorChange) {
        return
      }

      updateLabel.mutate(
        {
          labelId: selectedLabel.id,
          ...(hasNameChange && { name }),
          ...(hasColorChange && { color: editColor }),
        },
        {
          onSuccess: () => {
            setHasChanges(false)
          },
        },
      )
    }
  }, [editName, editColor, isCreating, selectedLabel, createLabel, updateLabel])

  // Cancel editing
  const handleCancel = useCallback(() => {
    if (isCreating) {
      setIsCreating(false)
      if (labels && labels.length > 0) {
        setSelectedLabelId(labels[0].id)
        loadLabelData(labels[0])
      }
    } else if (selectedLabel) {
      loadLabelData(selectedLabel)
    }
  }, [isCreating, labels, selectedLabel, loadLabelData])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deletingLabel) return

    deleteLabel.mutate(deletingLabel.id, {
      onSuccess: () => {
        setDeletingLabel(null)
        // Select the next available label
        if (deletingLabel.id === selectedLabelId) {
          const remaining = labels?.filter((l) => l.id !== deletingLabel.id) ?? []
          if (remaining.length > 0) {
            setSelectedLabelId(remaining[0].id)
            loadLabelData(remaining[0])
          } else {
            setSelectedLabelId(null)
            setEditName('')
            setEditColor(LABEL_COLORS[0])
          }
        }
      },
    })
  }, [deletingLabel, deleteLabel, selectedLabelId, labels, loadLabelData])

  // Handle keyboard shortcuts in editor
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && hasChanges) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        handleCancel()
      }
    },
    [hasChanges, handleSave, handleCancel],
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
      <div>
        <h3 className="text-lg font-medium text-zinc-100">Labels</h3>
        <p className="text-sm text-zinc-500">
          Manage labels used to categorize and filter tickets in this project.
        </p>
      </div>

      {/* Side-by-side layout */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Left Panel - Label List */}
        <div className="w-64 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-zinc-400">
              Labels
              {labels && labels.length > 0 && (
                <span className="ml-1.5 text-zinc-600">({labels.length})</span>
              )}
            </h4>
            {canManageLabels && (
              <Button variant="ghost" size="sm" onClick={handleStartCreate}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-3">
              {(!labels || labels.length === 0) && !isCreating ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="h-8 w-8 text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-500">No labels yet</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {canManageLabels
                      ? 'Click + to create your first label.'
                      : 'Labels will appear here when created.'}
                  </p>
                </div>
              ) : (
                <>
                  {labels?.map((label) => {
                    const ticketCount = label._count?.tickets ?? 0
                    const isSelected = selectedLabelId === label.id && !isCreating

                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleSelectLabel(label)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left',
                          isSelected
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                        )}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-white/10"
                          style={{ backgroundColor: label.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{label.name}</span>
                          <span className="text-xs text-zinc-500">
                            {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                    )
                  })}

                  {/* New label placeholder in list */}
                  {isCreating && (
                    <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-amber-900/20 border border-amber-700/50">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: editColor }}
                      />
                      <span className="text-sm font-medium text-amber-400 truncate">
                        {editName || 'New Label'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Label Editor */}
        <div className="flex-1 min-w-0">
          {selectedLabel || isCreating ? (
            <Card className="flex flex-col bg-zinc-900/50 border-zinc-800 h-full">
              <CardHeader className="flex-shrink-0 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: editColor }}
                  />
                  {canManageLabels ? (
                    <div className="group/title relative flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative flex-1">
                        <Input
                          ref={nameInputRef}
                          value={editName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          onKeyDown={handleEditorKeyDown}
                          placeholder="Label name..."
                          maxLength={50}
                          className="!text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 cursor-text"
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-700 group-hover/title:bg-zinc-500 group-focus-within/title:bg-amber-500 transition-colors" />
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-zinc-600 group-hover/title:text-zinc-400 group-focus-within/title:text-amber-500 transition-colors flex-shrink-0" />
                    </div>
                  ) : (
                    <CardTitle className="text-lg">{editName || 'New Label'}</CardTitle>
                  )}
                </div>
                <CardDescription>
                  {isCreating
                    ? 'Create a new label with a name and color.'
                    : 'Edit the name and color of this label.'}
                  {!canManageLabels && ' You need the "Manage labels" permission to edit labels.'}
                </CardDescription>
              </CardHeader>

              <ScrollArea className="flex-1 min-h-0">
                <CardContent className="pt-0 space-y-6">
                  {/* Live Preview */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-zinc-300">Preview</span>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white shadow-sm"
                        style={{ backgroundColor: editColor }}
                      >
                        {editName || 'Label name'}
                      </span>
                      <span className="text-xs text-zinc-500">
                        This is how the label will appear on tickets.
                      </span>
                    </div>
                  </div>

                  {/* Color */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-zinc-300">Color</span>
                    <ColorPickerBody
                      activeColor={editColor}
                      onColorChange={handleColorChange}
                      onApply={(color) => {
                        if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                          handleColorChange(color)
                        }
                      }}
                      isDisabled={!canManageLabels}
                    />
                  </div>

                  {/* Delete section (only for existing labels) */}
                  {!isCreating && selectedLabel && canManageLabels && (
                    <div className="space-y-2 pt-4 border-t border-zinc-800">
                      <span className="text-sm font-medium text-red-400">Danger Zone</span>
                      <p className="text-xs text-zinc-500">
                        Deleting this label will remove it from all tickets that use it.
                        {(selectedLabel._count?.tickets ?? 0) > 0 && (
                          <span className="text-amber-400">
                            {' '}
                            Currently used on {selectedLabel._count?.tickets} ticket
                            {selectedLabel._count?.tickets !== 1 ? 's' : ''}.
                          </span>
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingLabel(selectedLabel)}
                        className="border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-300 hover:border-red-700"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete Label
                      </Button>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>

              {/* Footer bar with save/cancel actions */}
              {canManageLabels && hasChanges && (
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
                  <p className="text-sm text-zinc-400">You have unsaved changes</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={!editName.trim() || createLabel.isPending || updateLabel.isPending}
                    >
                      {(createLabel.isPending || updateLabel.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isCreating ? 'Create Label' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {labels && labels.length > 0
                    ? 'Select a label to view and edit it'
                    : canManageLabels
                      ? 'Create your first label to get started'
                      : 'No labels have been created yet'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

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
