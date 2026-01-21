'use client'

import { AlertCircle, CheckCircle2, Loader2, MoveRight, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompleteSprint, useProjectSprints, useSprintDetail } from '@/hooks/queries/use-sprints'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { useBoardStore } from '@/stores/board-store'
import { useSprintStore } from '@/stores/sprint-store'
import { useUIStore } from '@/stores/ui-store'
import type { SprintCompletionAction } from '@/types'

interface SprintCompleteDialogProps {
  projectId: string
}

export function SprintCompleteDialog({ projectId }: SprintCompleteDialogProps) {
  const { sprintCompleteOpen, sprintCompleteId, closeSprintComplete } = useUIStore()
  const { dismissSprintPrompt } = useSprintStore()
  const { getColumns } = useBoardStore()
  const completeSprint = useCompleteSprint(projectId)
  const { data: sprints } = useProjectSprints(projectId)
  const { data: sprint } = useSprintDetail(projectId, sprintCompleteId ?? '')

  const [action, setAction] = useState<SprintCompletionAction>('close_to_next')
  const [targetSprintId, setTargetSprintId] = useState<string>('')
  const [createNextSprint, setCreateNextSprint] = useState(true)

  // Get planning sprints for target selection
  const planningSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'planning') ?? [],
    [sprints],
  )

  // Calculate completed vs incomplete counts from board store
  const { completedCount, incompleteCount } = useMemo(() => {
    if (!sprintCompleteId) return { completedCount: 0, incompleteCount: 0 }

    const columns = getColumns(projectId)
    const doneColumnIds = columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)

    let completed = 0
    let incomplete = 0

    columns.forEach((col) => {
      col.tickets.forEach((ticket) => {
        if (ticket.sprintId === sprintCompleteId) {
          if (doneColumnIds.includes(col.id)) {
            completed++
          } else {
            incomplete++
          }
        }
      })
    })

    return { completedCount: completed, incompleteCount: incomplete }
  }, [projectId, sprintCompleteId, getColumns])

  const handleClose = useCallback(() => {
    closeSprintComplete()
    setTimeout(() => {
      setAction('close_to_next')
      setTargetSprintId('')
      setCreateNextSprint(true)
    }, 200)
  }, [closeSprintComplete])

  const handleDismissLater = useCallback(() => {
    if (sprintCompleteId) {
      dismissSprintPrompt(sprintCompleteId, 'later')
    }
    handleClose()
  }, [sprintCompleteId, dismissSprintPrompt, handleClose])

  const handleSubmit = useCallback(async () => {
    if (!sprintCompleteId) return

    completeSprint.mutate(
      {
        sprintId: sprintCompleteId,
        options: {
          action,
          ...(action === 'close_to_next' && {
            targetSprintId: targetSprintId || undefined,
            createNextSprint: !targetSprintId && createNextSprint,
          }),
        },
      },
      {
        onSuccess: () => {
          handleClose()
        },
      },
    )
  }, [sprintCompleteId, action, targetSprintId, createNextSprint, completeSprint, handleClose])

  if (!sprintCompleteId) return null

  const totalTickets = incompleteCount + completedCount
  const hasIncomplete = incompleteCount > 0

  return (
    <Dialog open={sprintCompleteOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-100">
            Complete Sprint: {sprint?.name ?? 'Sprint'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            {sprint?.goal && <span className="block mb-2 italic">&ldquo;{sprint.goal}&rdquo;</span>}
            Review what was completed and decide what to do with remaining work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">{completedCount}</span>
              </div>
              <p className="text-sm text-green-400/70 mt-1">Completed</p>
            </div>
            <div className="flex-1 rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">{incompleteCount}</span>
              </div>
              <p className="text-sm text-orange-400/70 mt-1">Incomplete</p>
            </div>
          </div>

          {/* Completion rate */}
          {totalTickets > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Completion Rate</span>
                <span className="text-zinc-300">
                  {Math.round((completedCount / totalTickets) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(completedCount / totalTickets) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Action selection (only if there are incomplete tickets) */}
          {hasIncomplete && (
            <div className="space-y-3">
              <Label className="text-zinc-300">What should happen to incomplete tickets?</Label>
              <RadioGroup
                value={action}
                onValueChange={(v) => setAction(v as SprintCompletionAction)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 rounded-lg border border-zinc-800 p-3 hover:bg-zinc-900/50 cursor-pointer">
                  <RadioGroupItem value="close_to_next" id="close_to_next" />
                  <Label
                    htmlFor="close_to_next"
                    className="flex-1 cursor-pointer text-zinc-300 font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <MoveRight className="h-4 w-4 text-blue-400" />
                      <span>Move to next sprint</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Carry over incomplete work to continue later
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-zinc-800 p-3 hover:bg-zinc-900/50 cursor-pointer">
                  <RadioGroupItem value="close_to_backlog" id="close_to_backlog" />
                  <Label
                    htmlFor="close_to_backlog"
                    className="flex-1 cursor-pointer text-zinc-300 font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-amber-400" />
                      <span>Move to backlog</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Return tickets to the backlog for reprioritization
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-zinc-800 p-3 hover:bg-zinc-900/50 cursor-pointer">
                  <RadioGroupItem value="close_keep" id="close_keep" />
                  <Label
                    htmlFor="close_keep"
                    className="flex-1 cursor-pointer text-zinc-300 font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                      <span>Keep in sprint (close as-is)</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Close the sprint without moving incomplete tickets
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Target sprint selection */}
          {action === 'close_to_next' && hasIncomplete && (
            <div className="space-y-3 pl-6 border-l-2 border-zinc-800">
              {planningSprints.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-sm">Target Sprint</Label>
                  <Select value={targetSprintId} onValueChange={setTargetSprintId}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100">
                      <SelectValue placeholder="Create new sprint" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="">Create new sprint</SelectItem>
                      {planningSprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  A new sprint will be created to receive the incomplete tickets.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleDismissLater}
            disabled={completeSprint.isPending}
            className="text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
          >
            Remind me later
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={completeSprint.isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="primary" disabled={completeSprint.isPending}>
              {completeSprint.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete Sprint'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
