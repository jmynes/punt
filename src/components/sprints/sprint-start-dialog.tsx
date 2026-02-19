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
import { Label } from '@/components/ui/label'
import {
  useActiveSprint,
  useSprintDetail,
  useSprintSettings,
  useStartSprint,
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
  const { data: sprint } = useSprintDetail(projectId, sprintStartId ?? '')
  const { data: activeSprint } = useActiveSprint(projectId)
  const { data: settings } = useSprintSettings(projectId)

  const [startDateTime, setStartDateTime] = useState<Date | null>(null)
  const [endDateTime, setEndDateTime] = useState<Date | null>(null)

  // Initialize dates and times when sprint loads or dialog opens
  useEffect(() => {
    if (sprint && sprintStartOpen) {
      const defaultStartTime = settings?.defaultStartTime ?? '09:00'
      const defaultEndTime = settings?.defaultEndTime ?? '17:00'

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
      setStartDateTime(null)
      setEndDateTime(null)
    }, 200)
  }, [closeSprintStart])

  const handleSubmit = useCallback(async () => {
    if (!sprintStartId) return

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
  }, [sprintStartId, startDateTime, endDateTime, startSprint, handleClose])

  const hasActiveSprint = !!activeSprint

  useCtrlSave({
    onSave: handleSubmit,
    enabled: sprintStartOpen && !!sprintStartId && !hasActiveSprint && !startSprint.isPending,
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

          {/* Sprint goal */}
          {sprint?.goal && (
            <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
              <p className="text-xs text-zinc-500 mb-1">Sprint Goal</p>
              <p className="text-sm text-zinc-300">&ldquo;{sprint.goal}&rdquo;</p>
            </div>
          )}

          {/* Start Date & Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Start Date & Time</Label>
            <DateTimePicker
              value={startDateTime}
              onChange={setStartDateTime}
              disabled={startSprint.isPending || hasActiveSprint}
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
              disabled={startSprint.isPending || hasActiveSprint}
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
            disabled={startSprint.isPending}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={startSprint.isPending || hasActiveSprint}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {startSprint.isPending ? (
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
