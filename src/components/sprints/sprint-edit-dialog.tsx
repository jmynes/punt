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
import { useProjectSprints, useUpdateSprint } from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface FormData {
  name: string
  goal: string
  startDate: Date | null
  endDate: Date | null
  budget: string
}

const DEFAULT_FORM: FormData = {
  name: '',
  goal: '',
  startDate: null,
  endDate: null,
  budget: '',
}

interface SprintEditDialogProps {
  projectId: string
}

export function SprintEditDialog({ projectId }: SprintEditDialogProps) {
  const { sprintEditOpen, sprintEditId, closeSprintEdit } = useUIStore()
  const { data: sprints } = useProjectSprints(projectId)
  const updateSprint = useUpdateSprint(projectId)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)

  // Find the sprint being edited
  const sprint = sprints?.find((s) => s.id === sprintEditId)

  // Populate form when sprint changes
  useEffect(() => {
    if (sprint && sprintEditOpen) {
      setFormData({
        name: sprint.name,
        goal: sprint.goal || '',
        startDate: sprint.startDate ? new Date(sprint.startDate) : null,
        endDate: sprint.endDate ? new Date(sprint.endDate) : null,
        budget: sprint.budget?.toString() || '',
      })
    }
  }, [sprint, sprintEditOpen])

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
        startDate: formData.startDate,
        endDate: formData.endDate,
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
  const hasChanges =
    sprint &&
    (formData.name !== sprint.name ||
      formData.goal !== (sprint.goal || '') ||
      formData.startDate?.getTime() !==
        (sprint.startDate ? new Date(sprint.startDate).getTime() : undefined) ||
      formData.endDate?.getTime() !==
        (sprint.endDate ? new Date(sprint.endDate).getTime() : undefined) ||
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
