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
import { useCreateSprint, useSprintSettings } from '@/hooks/queries/use-sprints'
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

interface SprintCreateDialogProps {
  projectId: string
}

export function SprintCreateDialog({ projectId }: SprintCreateDialogProps) {
  const { sprintCreateOpen, setSprintCreateOpen } = useUIStore()
  const createSprint = useCreateSprint(projectId)
  const { data: settings } = useSprintSettings(projectId)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)

  // Apply settings-based defaults when dialog opens
  useEffect(() => {
    if (sprintCreateOpen) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const duration = settings?.defaultSprintDuration ?? 14
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + duration)

      const { hours: startH, minutes: startM } = parseTimeToHoursMinutes(
        settings?.defaultStartTime ?? '09:00',
      )
      const { hours: endH, minutes: endM } = parseTimeToHoursMinutes(
        settings?.defaultEndTime ?? '17:00',
      )

      const startDateTime = new Date(today)
      startDateTime.setHours(startH, startM, 0, 0)

      const endDateTime = new Date(endDate)
      endDateTime.setHours(endH, endM, 0, 0)

      setFormData((prev) => ({
        ...prev,
        startDateTime,
        endDateTime,
      }))
    }
  }, [
    sprintCreateOpen,
    settings?.defaultSprintDuration,
    settings?.defaultStartTime,
    settings?.defaultEndTime,
  ])

  const handleClose = useCallback(() => {
    setSprintCreateOpen(false)
    setTimeout(() => {
      setFormData(DEFAULT_FORM)
    }, 200)
  }, [setSprintCreateOpen])

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) return

    const budgetValue = formData.budget.trim()
    const budget = budgetValue ? Number.parseInt(budgetValue, 10) : null

    createSprint.mutate(
      {
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
  }, [formData, createSprint, handleClose])

  const isValid = formData.name.trim().length > 0

  useCtrlSave({
    onSave: handleSubmit,
    enabled: sprintCreateOpen && isValid && !createSprint.isPending,
  })

  return (
    <Dialog open={sprintCreateOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-100">Create Sprint</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Plan a new sprint for your project. Set a goal and timeline.
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
              disabled={createSprint.isPending}
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
              disabled={createSprint.isPending}
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
              disabled={createSprint.isPending}
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
              disabled={createSprint.isPending}
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
              disabled={createSprint.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={createSprint.isPending}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={!isValid || createSprint.isPending}
          >
            {createSprint.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Sprint'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
