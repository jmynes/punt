'use client'

import { ArrowRight, Calendar, Pencil, Tag, Target, User } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { DatePicker } from '@/components/tickets/date-picker'
import { LabelSelect } from '@/components/tickets/label-select'
import { PrioritySelect } from '@/components/tickets/priority-select'
import { UserSelect } from '@/components/tickets/user-select'
import { LoadingButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useProjectLabels } from '@/hooks/queries/use-labels'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { getTabId } from '@/hooks/use-realtime'
import { updateTickets } from '@/lib/actions/ticket-actions'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import type { LabelSummary, Priority, TicketWithRelations } from '@/types'

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  selectedTicketIds: Set<string>
}

type Step = 'fields' | 'confirm'

interface FieldState {
  assignee: { enabled: boolean; value: string | null }
  priority: { enabled: boolean; value: Priority }
  dueDate: { enabled: boolean; value: Date | null; clear: boolean }
  labels: { enabled: boolean; value: string[]; mode: 'add' | 'remove' | 'set' }
}

const INITIAL_FIELD_STATE: FieldState = {
  assignee: { enabled: false, value: null },
  priority: { enabled: false, value: 'medium' },
  dueDate: { enabled: false, value: null, clear: false },
  labels: { enabled: false, value: [], mode: 'add' },
}

export function BulkEditDialog({
  open,
  onOpenChange,
  projectId,
  selectedTicketIds,
}: BulkEditDialogProps) {
  const [step, setStep] = useState<Step>('fields')
  const [fields, setFields] = useState<FieldState>({ ...INITIAL_FIELD_STATE })
  const [isApplying, setIsApplying] = useState(false)

  const members = useProjectMembers(projectId)
  const currentUser = useCurrentUser()
  const { data: labels = [] } = useProjectLabels(projectId)
  const getColumns = useBoardStore((s) => s.getColumns)
  const clearSelection = useSelectionStore((s) => s.clearSelection)

  const count = selectedTicketIds.size

  // Get selected tickets from board store
  const selectedTickets = useMemo(() => {
    const columns = getColumns(projectId)
    const all = columns.flatMap((c) => c.tickets)
    return all.filter((t) => selectedTicketIds.has(t.id))
  }, [projectId, selectedTicketIds, getColumns])

  const hasChanges =
    fields.assignee.enabled ||
    fields.priority.enabled ||
    fields.dueDate.enabled ||
    fields.labels.enabled

  const handleReset = useCallback(() => {
    setFields({ ...INITIAL_FIELD_STATE })
    setStep('fields')
    setIsApplying(false)
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    // Reset after animation
    setTimeout(handleReset, 200)
  }, [onOpenChange, handleReset])

  const handleApply = useCallback(async () => {
    if (!hasChanges || selectedTickets.length === 0) return

    setIsApplying(true)
    try {
      const updates: Array<{ ticketId: string; changes: Partial<TicketWithRelations> }> = []

      for (const ticket of selectedTickets) {
        const changes: Partial<TicketWithRelations> = {}

        if (fields.assignee.enabled) {
          changes.assigneeId = fields.assignee.value
        }

        if (fields.priority.enabled) {
          changes.priority = fields.priority.value
        }

        if (fields.dueDate.enabled) {
          changes.dueDate = fields.dueDate.clear ? null : fields.dueDate.value
        }

        if (fields.labels.enabled) {
          const currentLabelIds = ticket.labels.map((l) => l.id)
          let newLabelIds: string[]

          switch (fields.labels.mode) {
            case 'set':
              newLabelIds = fields.labels.value
              break
            case 'add':
              newLabelIds = [...new Set([...currentLabelIds, ...fields.labels.value])]
              break
            case 'remove':
              newLabelIds = currentLabelIds.filter((id) => !fields.labels.value.includes(id))
              break
          }

          // Convert label IDs to LabelSummary objects
          changes.labels = newLabelIds
            .map((id) => labels.find((l) => l.id === id))
            .filter(Boolean) as LabelSummary[]
        }

        if (Object.keys(changes).length > 0) {
          updates.push({ ticketId: ticket.id, changes })
        }
      }

      if (updates.length === 0) {
        handleClose()
        return
      }

      await updateTickets({
        projectId,
        updates,
        tabId: getTabId(),
        options: { undo: true, optimistic: true },
      })

      showUndoRedoToast('success', {
        title: `Updated ${updates.length} ticket${updates.length === 1 ? '' : 's'}`,
        description: 'Ctrl+Z to undo',
      })

      clearSelection()
      handleClose()
    } catch (err) {
      showToast.error('Bulk edit failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setIsApplying(false)
    }
  }, [hasChanges, selectedTickets, fields, labels, projectId, clearSelection, handleClose])

  // Build summary of changes for confirmation step
  const changeSummary = useMemo(() => {
    const items: Array<{ field: string; description: string }> = []

    if (fields.assignee.enabled) {
      const user = members.find((m) => m.id === fields.assignee.value)
      items.push({
        field: 'Assignee',
        description: user ? user.name : 'Unassigned',
      })
    }

    if (fields.priority.enabled) {
      items.push({
        field: 'Priority',
        description: fields.priority.value.charAt(0).toUpperCase() + fields.priority.value.slice(1),
      })
    }

    if (fields.dueDate.enabled) {
      items.push({
        field: 'Due date',
        description: fields.dueDate.clear
          ? 'Clear'
          : fields.dueDate.value
            ? fields.dueDate.value.toLocaleDateString()
            : 'No date',
      })
    }

    if (fields.labels.enabled) {
      const labelNames = fields.labels.value
        .map((id) => labels.find((l) => l.id === id)?.name)
        .filter(Boolean)
      const modeLabel =
        fields.labels.mode === 'add' ? 'Add' : fields.labels.mode === 'remove' ? 'Remove' : 'Set to'
      items.push({
        field: 'Labels',
        description:
          labelNames.length > 0 ? `${modeLabel}: ${labelNames.join(', ')}` : `${modeLabel}: (none)`,
      })
    }

    return items
  }, [fields, members, labels])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Pencil className="h-4 w-4" />
            Bulk edit | {count} ticket{count === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {step === 'fields'
              ? 'Select fields to update across all selected tickets.'
              : 'Preview and confirm bulk updates below.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'fields' && (
          <div className="space-y-4 py-2">
            {/* Assignee */}
            <FieldRow
              icon={User}
              label="Assignee"
              enabled={fields.assignee.enabled}
              onToggle={(enabled) =>
                setFields((f) => ({ ...f, assignee: { ...f.assignee, enabled } }))
              }
            >
              <UserSelect
                value={fields.assignee.value}
                onChange={(value) =>
                  setFields((f) => ({ ...f, assignee: { ...f.assignee, value } }))
                }
                users={members}
                currentUserId={currentUser?.id}
                disabled={!fields.assignee.enabled}
              />
            </FieldRow>

            {/* Priority */}
            <FieldRow
              icon={Target}
              label="Priority"
              enabled={fields.priority.enabled}
              onToggle={(enabled) =>
                setFields((f) => ({ ...f, priority: { ...f.priority, enabled } }))
              }
            >
              <PrioritySelect
                value={fields.priority.value}
                onChange={(value) =>
                  setFields((f) => ({ ...f, priority: { ...f.priority, value } }))
                }
                disabled={!fields.priority.enabled}
              />
            </FieldRow>

            {/* Due Date */}
            <FieldRow
              icon={Calendar}
              label="Due date"
              enabled={fields.dueDate.enabled}
              onToggle={(enabled) =>
                setFields((f) => ({ ...f, dueDate: { ...f.dueDate, enabled } }))
              }
              onClear={() =>
                setFields((f) => ({
                  ...f,
                  dueDate: { enabled: true, value: null, clear: true },
                }))
              }
              showClear={fields.dueDate.enabled && !fields.dueDate.clear}
            >
              {fields.dueDate.clear ? (
                <p className="text-sm text-zinc-500 italic">Will be cleared</p>
              ) : (
                <DatePicker
                  value={fields.dueDate.value}
                  onChange={(value) =>
                    setFields((f) => ({
                      ...f,
                      dueDate: { enabled: true, value, clear: false },
                    }))
                  }
                  disabled={!fields.dueDate.enabled}
                />
              )}
            </FieldRow>

            {/* Labels */}
            <FieldRow
              icon={Tag}
              label="Labels"
              enabled={fields.labels.enabled}
              onToggle={(enabled) => setFields((f) => ({ ...f, labels: { ...f.labels, enabled } }))}
            >
              <div className="space-y-2">
                <div className="flex gap-1">
                  {(['add', 'remove', 'set'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFields((f) => ({ ...f, labels: { ...f.labels, mode } }))}
                      disabled={!fields.labels.enabled}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        fields.labels.mode === mode
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-600/50'
                          : 'text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                      } disabled:opacity-50`}
                    >
                      {mode === 'add' ? 'Add' : mode === 'remove' ? 'Remove' : 'Set to'}
                    </button>
                  ))}
                </div>
                <LabelSelect
                  value={fields.labels.value}
                  onChange={(value) => setFields((f) => ({ ...f, labels: { ...f.labels, value } }))}
                  labels={labels}
                  disabled={!fields.labels.enabled}
                  projectId={projectId}
                />
              </div>
            </FieldRow>
          </div>
        )}

        {step === 'confirm' && (
          <div className="py-2">
            <div className="space-y-2">
              {changeSummary.map((item) => (
                <div
                  key={item.field}
                  className="flex items-center gap-3 p-3 rounded-md bg-zinc-800/50 border border-zinc-700/50"
                >
                  <span className="text-sm font-medium text-zinc-300 w-20">{item.field}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                  <span className="text-sm text-zinc-200">{item.description}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-3">
              This will update {count} ticket{count === 1 ? '' : 's'}. You can undo with Ctrl+Z.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'fields' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <LoadingButton
                variant="primary"
                disabled={!hasChanges}
                onClick={() => setStep('confirm')}
              >
                Next
              </LoadingButton>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('fields')}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Back
              </button>
              <LoadingButton
                variant="primary"
                loading={isApplying}
                loadingText="Applying..."
                onClick={handleApply}
              >
                Apply to {count} ticket{count === 1 ? '' : 's'}
              </LoadingButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- FieldRow helper ---

function FieldRow({
  icon: Icon,
  label,
  enabled,
  onToggle,
  onClear,
  showClear,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onClear?: () => void
  showClear?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={enabled}
            onCheckedChange={(checked) => onToggle(checked === true)}
            className="border-zinc-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
          />
          <Label
            className="flex items-center gap-1.5 text-sm text-zinc-300 cursor-pointer"
            onClick={() => onToggle(!enabled)}
          >
            <Icon className="h-3.5 w-3.5 text-zinc-500" />
            {label}
          </Label>
        </div>
        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      {enabled && <div className="ml-7">{children}</div>}
    </div>
  )
}
