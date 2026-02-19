'use client'

import { format } from 'date-fns'
import { AlertTriangle, CalendarIcon, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'
import {
  useActiveSprint,
  useSprintDetail,
  useSprintSettings,
  useStartSprint,
} from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

/**
 * Extract time string (HH:mm) from a Date object
 */
function extractTimeFromDate(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Parse time string (HH:mm) and apply it to a date
 */
function applyTimeToDate(date: Date | null, time: string): Date | null {
  if (!date) return null
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
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

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [startTime, setStartTime] = useState<string>('09:00')
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [endTime, setEndTime] = useState<string>('17:00')

  // Initialize dates and times when sprint loads or dialog opens
  useEffect(() => {
    if (sprint && sprintStartOpen) {
      // Use project-level default times or fall back to system defaults
      const defaultStartTime = settings?.defaultStartTime ?? '09:00'
      const defaultEndTime = settings?.defaultEndTime ?? '17:00'

      const start = sprint.startDate ? new Date(sprint.startDate) : new Date()
      // If the existing date has meaningful time info (not midnight), use it
      const existingStartTime = sprint.startDate
        ? extractTimeFromDate(new Date(sprint.startDate))
        : null
      const hasStartTime = existingStartTime && existingStartTime !== '00:00'

      setStartDate(start)
      setStartTime(hasStartTime ? existingStartTime : defaultStartTime)

      if (sprint.endDate) {
        const end = new Date(sprint.endDate)
        const existingEndTime = extractTimeFromDate(end)
        const hasEndTime = existingEndTime !== '00:00'
        setEndDate(end)
        setEndTime(hasEndTime ? existingEndTime : defaultEndTime)
      } else {
        const duration = settings?.defaultSprintDuration ?? 14
        const end = new Date(start)
        end.setDate(end.getDate() + duration)
        setEndDate(end)
        setEndTime(defaultEndTime)
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
      setStartDate(null)
      setStartTime('09:00')
      setEndDate(null)
      setEndTime('17:00')
    }, 200)
  }, [closeSprintStart])

  const handleSubmit = useCallback(async () => {
    if (!sprintStartId) return

    // Combine date and time for submission
    const startDateTime = applyTimeToDate(startDate, startTime)
    const endDateTime = applyTimeToDate(endDate, endTime)

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
  }, [sprintStartId, startDate, startTime, endDate, endTime, startSprint, handleClose])

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
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800',
                      !startDate && 'text-zinc-500',
                    )}
                    disabled={startSprint.isPending || hasActiveSprint}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ?? undefined}
                    onSelect={(date) => setStartDate(date ?? null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={startTime}
                onChange={setStartTime}
                disabled={startSprint.isPending || hasActiveSprint}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          {/* End Date & Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">End Date & Time</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800',
                      !endDate && 'text-zinc-500',
                    )}
                    disabled={startSprint.isPending || hasActiveSprint}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ?? undefined}
                    onSelect={(date) => setEndDate(date ?? null)}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                disabled={startSprint.isPending || hasActiveSprint}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          {/* Duration info */}
          {startDate && endDate && (
            <p className="text-sm text-zinc-500">
              Duration:{' '}
              {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
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
