'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TimePicker } from '@/components/ui/time-picker'
import { useSprintSettings, useUpdateSprintSettings } from '@/hooks/queries/use-sprints'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'

interface SprintsTabProps {
  projectId: string
  projectKey: string
}

interface FormData {
  defaultSprintDuration: number
  autoCarryOverIncomplete: boolean
  defaultStartTime: string
  defaultEndTime: string
}

export function SprintsTab({ projectId, projectKey: _projectKey }: SprintsTabProps) {
  const { data: settings, isLoading } = useSprintSettings(projectId)
  const updateSettings = useUpdateSprintSettings(projectId)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)

  const [formData, setFormData] = useState<FormData>({
    defaultSprintDuration: 14,
    autoCarryOverIncomplete: true,
    defaultStartTime: '09:00',
    defaultEndTime: '17:00',
  })

  // Sync form data with fetched settings
  useEffect(() => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration,
        autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
      })
    }
  }, [settings])

  const hasChanges =
    settings &&
    (formData.defaultSprintDuration !== settings.defaultSprintDuration ||
      formData.autoCarryOverIncomplete !== settings.autoCarryOverIncomplete ||
      formData.defaultStartTime !== settings.defaultStartTime ||
      formData.defaultEndTime !== settings.defaultEndTime)

  const handleSave = useCallback(async () => {
    if (!canEditSettings || !hasChanges) return

    updateSettings.mutate({
      defaultSprintDuration: formData.defaultSprintDuration,
      autoCarryOverIncomplete: formData.autoCarryOverIncomplete,
      defaultStartTime: formData.defaultStartTime,
      defaultEndTime: formData.defaultEndTime,
    })
  }, [canEditSettings, hasChanges, formData, updateSettings])

  const handleReset = useCallback(() => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration,
        autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
      })
    }
  }, [settings])

  const isValid = formData.defaultSprintDuration >= 1 && formData.defaultSprintDuration <= 90
  const isPending = updateSettings.isPending
  const isDisabled = !canEditSettings || isPending

  useCtrlSave({
    onSave: handleSave,
    enabled: !!hasChanges && isValid && !isDisabled,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-zinc-100">Sprint Settings</h3>
        <p className="text-sm text-zinc-500">Configure default sprint behavior for this project.</p>
      </div>

      {/* Sprint Defaults Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Sprint Defaults</CardTitle>
          <CardDescription>
            These settings are used as defaults when creating new sprints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Sprint Duration */}
          <div className="space-y-2">
            <Label htmlFor="sprint-duration" className="text-zinc-300">
              Default Sprint Duration (days)
            </Label>
            <Input
              id="sprint-duration"
              type="number"
              min={1}
              max={90}
              value={formData.defaultSprintDuration}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(value)) {
                  setFormData((prev) => ({ ...prev, defaultSprintDuration: value }))
                }
              }}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 w-32"
              disabled={isDisabled}
            />
            <p className="text-xs text-zinc-500">
              The number of days a sprint lasts by default (1-90)
            </p>
          </div>

          {/* Default Start Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default Start Time</Label>
            <div className="max-w-[200px]">
              <TimePicker
                value={formData.defaultStartTime}
                onChange={(time) => setFormData((prev) => ({ ...prev, defaultStartTime: time }))}
                disabled={isDisabled}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The default start time for new sprints (e.g., 09:00 for 9 AM)
            </p>
          </div>

          {/* Default End Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default End Time</Label>
            <div className="max-w-[200px]">
              <TimePicker
                value={formData.defaultEndTime}
                onChange={(time) => setFormData((prev) => ({ ...prev, defaultEndTime: time }))}
                disabled={isDisabled}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The default end time for sprints (e.g., 17:00 for 5 PM)
            </p>
          </div>

          {/* Auto Carryover */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-zinc-300">Auto-carryover incomplete tickets</Label>
              <p className="text-xs text-zinc-500">
                Automatically move incomplete tickets to the next sprint when completing a sprint
              </p>
            </div>
            <Switch
              checked={formData.autoCarryOverIncomplete}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, autoCarryOverIncomplete: checked }))
              }
              disabled={isDisabled}
            />
          </div>

          {/* Save/Reset buttons */}
          {canEditSettings && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || isPending}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || !isValid || isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
