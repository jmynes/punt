'use client'

import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
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
import { useCreateSprint, useSprintSettings } from '@/hooks/queries/use-sprints'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface FormData {
  name: string
  goal: string
  startDate: Date | null
  endDate: Date | null
}

const DEFAULT_FORM: FormData = {
  name: '',
  goal: '',
  startDate: null,
  endDate: null,
}

interface SprintCreateDialogProps {
  projectId: string
}

export function SprintCreateDialog({ projectId }: SprintCreateDialogProps) {
  const { sprintCreateOpen, setSprintCreateOpen } = useUIStore()
  const createSprint = useCreateSprint(projectId)
  const { data: settings } = useSprintSettings(projectId)
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)

  const handleClose = useCallback(() => {
    setSprintCreateOpen(false)
    setTimeout(() => {
      setFormData(DEFAULT_FORM)
    }, 200)
  }, [setSprintCreateOpen])

  // Set default dates when dialog opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !formData.startDate) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const duration = settings?.defaultSprintDuration ?? 14
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + duration)
        setFormData((prev) => ({
          ...prev,
          startDate: today,
          endDate,
        }))
      }
      if (!open) {
        handleClose()
      } else {
        setSprintCreateOpen(true)
      }
    },
    [formData.startDate, settings?.defaultSprintDuration, handleClose, setSprintCreateOpen],
  )

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) return

    createSprint.mutate(
      {
        name: formData.name.trim(),
        goal: formData.goal.trim() || null,
        startDate: formData.startDate,
        endDate: formData.endDate,
      },
      {
        onSuccess: () => {
          handleClose()
        },
      },
    )
  }, [formData, createSprint, handleClose])

  const isValid = formData.name.trim().length > 0

  return (
    <Dialog open={sprintCreateOpen} onOpenChange={handleOpenChange}>
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
                    disabled={createSprint.isPending}
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
                    disabled={createSprint.isPending}
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
