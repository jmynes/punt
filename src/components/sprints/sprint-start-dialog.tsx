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
import {
  useActiveSprint,
  useSprintDetail,
  useSprintSettings,
  useStartSprint,
} from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

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
  const [endDate, setEndDate] = useState<Date | null>(null)

  // Initialize dates when sprint loads
  useEffect(() => {
    if (sprint) {
      const start = sprint.startDate ? new Date(sprint.startDate) : new Date()
      start.setHours(0, 0, 0, 0)
      setStartDate(start)

      if (sprint.endDate) {
        setEndDate(new Date(sprint.endDate))
      } else {
        const duration = settings?.defaultSprintDuration ?? 14
        const end = new Date(start)
        end.setDate(end.getDate() + duration)
        setEndDate(end)
      }
    }
  }, [sprint, settings?.defaultSprintDuration])

  const handleClose = useCallback(() => {
    closeSprintStart()
    setTimeout(() => {
      setStartDate(null)
      setEndDate(null)
    }, 200)
  }, [closeSprintStart])

  const handleSubmit = useCallback(async () => {
    if (!sprintStartId) return

    startSprint.mutate(
      {
        sprintId: sprintStartId,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      },
      {
        onSuccess: () => {
          handleClose()
        },
      },
    )
  }, [sprintStartId, startDate, endDate, startSprint, handleClose])

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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Start Date</Label>
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
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label className="text-zinc-300">End Date</Label>
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
