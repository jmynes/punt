'use client'

import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import { useProjectSprints, useSprintSettings, useUpdateSprint } from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface FormData {
  name: string
  goal: string
  startDate: Date | null
  startTime: string // HH:mm
  endDate: Date | null
  endTime: string // HH:mm
  budget: string
}

const DEFAULT_FORM: FormData = {
  name: '',
  goal: '',
  startDate: null,
  startTime: '09:00',
  endDate: null,
  endTime: '17:00',
  budget: '',
}

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

interface SprintEditDialogProps {
  projectId: string
}

export function SprintEditDialog({ projectId }: SprintEditDialogProps) {
  const { sprintEditOpen, sprintEditId, closeSprintEdit } = useUIStore()
  const { data: sprints } = useProjectSprints(projectId)
  const { data: settings } = useSprintSettings(projectId)
  const updateSprint = useUpdateSprint(projectId)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)

  // Find the sprint being edited
  const sprint = sprints?.find((s) => s.id === sprintEditId)

  // Populate form when sprint changes
  useEffect(() => {
    if (sprint && sprintEditOpen) {
      // Use project-level default times or fall back to system defaults
      const defaultStartTime = settings?.defaultStartTime ?? '09:00'
      const defaultEndTime = settings?.defaultEndTime ?? '17:00'

      let startTime = defaultStartTime
      let endTime = defaultEndTime

      // Extract time from existing dates if present and not midnight
      if (sprint.startDate) {
        const existingTime = extractTimeFromDate(new Date(sprint.startDate))
        if (existingTime !== '00:00') {
          startTime = existingTime
        }
      }
      if (sprint.endDate) {
        const existingTime = extractTimeFromDate(new Date(sprint.endDate))
        if (existingTime !== '00:00') {
          endTime = existingTime
        }
      }

      setFormData({
        name: sprint.name,
        goal: sprint.goal || '',
        startDate: sprint.startDate ? new Date(sprint.startDate) : null,
        startTime,
        endDate: sprint.endDate ? new Date(sprint.endDate) : null,
        endTime,
        budget: sprint.budget?.toString() || '',
      })
    }
  }, [sprint, sprintEditOpen, settings?.defaultStartTime, settings?.defaultEndTime])

  const handleClose = useCallback(() => {
    closeSprintEdit()
    setTimeout(() => {
      setFormData(DEFAULT_FORM)
    }, 200)
  }, [closeSprintEdit])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose()
      }
    },
    [handleClose],
  )

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim() || !sprintEditId) return

    const budgetValue = formData.budget.trim()
    const budget = budgetValue ? Number.parseInt(budgetValue, 10) : null

    // Combine date and time for submission
    const startDateTime = applyTimeToDate(formData.startDate, formData.startTime)
    const endDateTime = applyTimeToDate(formData.endDate, formData.endTime)

    updateSprint.mutate(
      {
        sprintId: sprintEditId,
        name: formData.name.trim(),
        goal: formData.goal.trim() || null,
        startDate: startDateTime,
        endDate: endDateTime,
        budget: budget && !Number.isNaN(budget) ? budget : null,
      },
      {
        onSuccess: () => {
          handleClose()
        },
      },
    )
  }, [formData, sprintEditId, updateSprint, handleClose])

  const isValid = formData.name.trim().length > 0

  // Build comparison values including times
  const currentStartDateTime = applyTimeToDate(formData.startDate, formData.startTime)?.getTime()
  const currentEndDateTime = applyTimeToDate(formData.endDate, formData.endTime)?.getTime()
  const sprintStartDateTime = sprint?.startDate ? new Date(sprint.startDate).getTime() : undefined
  const sprintEndDateTime = sprint?.endDate ? new Date(sprint.endDate).getTime() : undefined

  const hasChanges =
    sprint &&
    (formData.name !== sprint.name ||
      formData.goal !== (sprint.goal || '') ||
      currentStartDateTime !== sprintStartDateTime ||
      currentEndDateTime !== sprintEndDateTime ||
      formData.budget !== (sprint.budget?.toString() || ''))

  useCtrlSave({
    onSave: handleSubmit,
    enabled: sprintEditOpen && isValid && !!hasChanges && !updateSprint.isPending,
  })

  return (
    <Dialog open={sprintEditOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-100">Edit Sprint</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Update the sprint details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sprint Name */}
          <div className="space-y-2">
            <Label htmlFor="sprint-name" className="text-zinc-300">
              Sprint Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sprint-name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Sprint 1"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              disabled={updateSprint.isPending}
              autoFocus
            />
          </div>

          {/* Sprint Goal */}
          <div className="space-y-2">
            <Label htmlFor="sprint-goal" className="text-zinc-300">
              Sprint Goal
            </Label>
            <Textarea
              id="sprint-goal"
              value={formData.goal}
              onChange={(e) => setFormData((prev) => ({ ...prev, goal: e.target.value }))}
              placeholder="What do you want to accomplish this sprint?"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 resize-none"
              rows={2}
              disabled={updateSprint.isPending}
            />
          </div>

          {/* Story Point Budget */}
          <div className="space-y-2">
            <Label htmlFor="sprint-budget" className="text-zinc-300">
              Story Point Budget
            </Label>
            <Input
              id="sprint-budget"
              type="number"
              min={1}
              max={9999}
              value={formData.budget}
              onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
              placeholder="Expected capacity (optional)"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              disabled={updateSprint.isPending}
            />
            <p className="text-xs text-zinc-500">
              Set a target for how many story points to complete this sprint
            </p>
          </div>

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
                      !formData.startDate && 'text-zinc-500',
                    )}
                    disabled={updateSprint.isPending}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.startDate ?? undefined}
                    onSelect={(date) =>
                      setFormData((prev) => ({ ...prev, startDate: date ?? null }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={formData.startTime}
                onChange={(time) => setFormData((prev) => ({ ...prev, startTime: time }))}
                disabled={updateSprint.isPending}
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
                      !formData.endDate && 'text-zinc-500',
                    )}
                    disabled={updateSprint.isPending}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.endDate ? format(formData.endDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.endDate ?? undefined}
                    onSelect={(date) => setFormData((prev) => ({ ...prev, endDate: date ?? null }))}
                    disabled={(date) => (formData.startDate ? date < formData.startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                value={formData.endTime}
                onChange={(time) => setFormData((prev) => ({ ...prev, endTime: time }))}
                disabled={updateSprint.isPending}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateSprint.isPending}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={!isValid || !hasChanges || updateSprint.isPending}
          >
            {updateSprint.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
