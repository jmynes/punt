'use client'

import { Loader2 } from 'lucide-react'
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
import { useProjectSprints, useSprintSettings, useUpdateSprint } from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useUIStore } from '@/stores/ui-store'

interface FormData {
  name: string
  goal: string
  startDateTime: Date | null
  endDateTime: Date | null
  budget: string
}

const DEFAULT_FORM: FormData = {
  name: '',
  goal: '',
  startDateTime: null,
  endDateTime: null,
  budget: '',
}

function parseTimeToHoursMinutes(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number)
  return { hours: h, minutes: m }
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
      const defaultStartTime = settings?.defaultStartTime ?? '09:00'
      const defaultEndTime = settings?.defaultEndTime ?? '17:00'

      let startDateTime: Date | null = null
      if (sprint.startDate) {
        startDateTime = new Date(sprint.startDate)
        // If time is midnight and not intentional, apply default
        if (startDateTime.getHours() === 0 && startDateTime.getMinutes() === 0) {
          const { hours, minutes } = parseTimeToHoursMinutes(defaultStartTime)
          startDateTime.setHours(hours, minutes, 0, 0)
        }
      }

      let endDateTime: Date | null = null
      if (sprint.endDate) {
        endDateTime = new Date(sprint.endDate)
        if (endDateTime.getHours() === 0 && endDateTime.getMinutes() === 0) {
          const { hours, minutes } = parseTimeToHoursMinutes(defaultEndTime)
          endDateTime.setHours(hours, minutes, 0, 0)
        }
      }

      setFormData({
        name: sprint.name,
        goal: sprint.goal || '',
        startDateTime,
        endDateTime,
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

    updateSprint.mutate(
      {
        sprintId: sprintEditId,
        name: formData.name.trim(),
        goal: formData.goal.trim() || null,
        startDate: formData.startDateTime,
        endDate: formData.endDateTime,
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

  // Build comparison values
  const currentStartDateTime = formData.startDateTime?.getTime()
  const currentEndDateTime = formData.endDateTime?.getTime()
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
            <DateTimePicker
              value={formData.startDateTime}
              onChange={(date) => setFormData((prev) => ({ ...prev, startDateTime: date }))}
              disabled={updateSprint.isPending}
            />
          </div>

          {/* End Date & Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">End Date & Time</Label>
            <DateTimePicker
              value={formData.endDateTime}
              onChange={(date) => setFormData((prev) => ({ ...prev, endDateTime: date }))}
              disabledDates={(date) => {
                if (!formData.startDateTime) return false
                const startDay = new Date(formData.startDateTime)
                startDay.setHours(0, 0, 0, 0)
                return date < startDay
              }}
              disabled={updateSprint.isPending}
            />
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
