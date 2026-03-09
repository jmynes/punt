'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/date-time-picker'
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
import {
  useActiveSprint,
  useSprintDetail,
  useSprintSettings,
  useStartSprint,
  useUpdateSprint,
} from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useUIStore } from '@/stores/ui-store'

function parseTimeToHoursMinutes(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number)
  return { hours: h, minutes: m }
}

interface SprintStartDialogProps {
  projectId: string
}

export function SprintStartDialog({ projectId }: SprintStartDialogProps) {
  const { sprintStartOpen, sprintStartId, closeSprintStart } = useUIStore()
  const startSprint = useStartSprint(projectId)
  const updateSprint = useUpdateSprint(projectId)
  const { data: sprint } = useSprintDetail(projectId, sprintStartId ?? '')
  const { data: activeSprint } = useActiveSprint(projectId)
  const { data: settings } = useSprintSettings(projectId)

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState('')
  const [startDateTime, setStartDateTime] = useState<Date | null>(null)
  const [endDateTime, setEndDateTime] = useState<Date | null>(null)

  // Initialize form fields when sprint loads or dialog opens
  useEffect(() => {
    if (sprint && sprintStartOpen) {
      const defaultStartTime = settings?.defaultStartTime ?? '09:00'
      const defaultEndTime = settings?.defaultEndTime ?? '17:00'

      // Populate editable fields
      setName(sprint.name)
      setGoal(sprint.goal || '')
      setBudget(sprint.budget?.toString() || '')

      const start = sprint.startDate ? new Date(sprint.startDate) : new Date()
      // If time is midnight and not intentional, apply default
      if (start.getHours() === 0 && start.getMinutes() === 0) {
        const { hours, minutes } = parseTimeToHoursMinutes(defaultStartTime)
        start.setHours(hours, minutes, 0, 0)
      }
      setStartDateTime(start)

      if (sprint.endDate) {
        const end = new Date(sprint.endDate)
        if (end.getHours() === 0 && end.getMinutes() === 0) {
          const { hours, minutes } = parseTimeToHoursMinutes(defaultEndTime)
          end.setHours(hours, minutes, 0, 0)
        }
        setEndDateTime(end)
      } else {
        const duration = settings?.defaultSprintDuration ?? 14
        const end = new Date(start)
        end.setDate(end.getDate() + duration)
        const { hours, minutes } = parseTimeToHoursMinutes(defaultEndTime)
        end.setHours(hours, minutes, 0, 0)
        setEndDateTime(end)
      }
    }
  }, [
    sprint,
    sprintStartOpen,
    settings?.defaultSprintDuration,
    settings?.defaultStartTime,
    settings?.defaultEndTime,
  ])

  const handleClose = useCallback(() => {
    closeSprintStart()
    setTimeout(() => {
      setName('')
      setGoal('')
      setBudget('')
      setStartDateTime(null)
      setEndDateTime(null)
    }, 200)
  }, [closeSprintStart])

  // Check if sprint details have changed
  const hasDetailChanges =
    sprint &&
    (name !== sprint.name ||
      goal !== (sprint.goal || '') ||
      budget !== (sprint.budget?.toString() || ''))

  const handleSubmit = useCallback(async () => {
    if (!sprintStartId || !name.trim()) return

    const budgetValue = budget.trim()
    const parsedBudget = budgetValue ? Number.parseInt(budgetValue, 10) : null

    // If details changed, update first then start
    if (hasDetailChanges) {
      updateSprint.mutate(
        {
          sprintId: sprintStartId,
          name: name.trim(),
          goal: goal.trim() || null,
          budget: parsedBudget && !Number.isNaN(parsedBudget) ? parsedBudget : null,
        },
        {
          onSuccess: () => {
            startSprint.mutate(
              {
                sprintId: sprintStartId,
                startDate: startDateTime ?? undefined,
                endDate: endDateTime ?? undefined,
              },
              {
                onSuccess: () => {
                  handleClose()
                },
              },
            )
          },
        },
      )
    } else {
      // Just start the sprint
      startSprint.mutate(
        {
          sprintId: sprintStartId,
          startDate: startDateTime ?? undefined,
          endDate: endDateTime ?? undefined,
        },
        {
          onSuccess: () => {
            handleClose()
          },
        },
      )
    }
  }, [
    sprintStartId,
    name,
    goal,
    budget,
    hasDetailChanges,
    startDateTime,
    endDateTime,
    updateSprint,
    startSprint,
    handleClose,
  ])

  const hasActiveSprint = !!activeSprint

  useCtrlSave({
    onSave: handleSubmit,
    enabled:
      sprintStartOpen &&
      !!sprintStartId &&
      !hasActiveSprint &&
      !startSprint.isPending &&
      !updateSprint.isPending &&
      !!name.trim(),
  })

  if (!sprintStartId) return null

  return (
    <Dialog open={sprintStartOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-100">
            Start Sprint: {sprint?.name ?? 'Sprint'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Confirm the sprint dates and start the sprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning if there's already an active sprint */}
          {hasActiveSprint && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-400">
                <p className="font-medium">Active sprint exists</p>
                <p className="text-amber-400/70 mt-1">
                  You must complete &ldquo;{activeSprint.name}&rdquo; before starting a new sprint.
                </p>
              </div>
            </div>
          )}

          {/* Sprint Name */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint name"
              disabled={startSprint.isPending || updateSprint.isPending || hasActiveSprint}
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
          </div>

          {/* Sprint Goal */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Goal</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do you want to achieve in this sprint?"
              disabled={startSprint.isPending || updateSprint.isPending || hasActiveSprint}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 min-h-[80px]"
            />
          </div>

          {/* Sprint Budget/Capacity */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Capacity (story points)</Label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Story points capacity"
              min={0}
              disabled={startSprint.isPending || updateSprint.isPending || hasActiveSprint}
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
          </div>

          {/* Start Date & Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Start Date & Time</Label>
            <DateTimePicker
              value={startDateTime}
              onChange={setStartDateTime}
              disabled={startSprint.isPending || updateSprint.isPending || hasActiveSprint}
            />
          </div>

          {/* End Date & Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">End Date & Time</Label>
            <DateTimePicker
              value={endDateTime}
              onChange={setEndDateTime}
              disabledDates={(date) => {
                if (!startDateTime) return false
                const startDay = new Date(startDateTime)
                startDay.setHours(0, 0, 0, 0)
                return date < startDay
              }}
              disabled={startSprint.isPending || updateSprint.isPending || hasActiveSprint}
            />
          </div>

          {/* Duration info */}
          {startDateTime && endDateTime && (
            <p className="text-sm text-zinc-500">
              Duration:{' '}
              {Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24))}{' '}
              days
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={startSprint.isPending || updateSprint.isPending}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              startSprint.isPending || updateSprint.isPending || hasActiveSprint || !name.trim()
            }
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {updateSprint.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : startSprint.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Sprint'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
