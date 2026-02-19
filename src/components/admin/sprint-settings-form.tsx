'use client'

import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'

export function SprintSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [defaultSprintStartTime, setDefaultSprintStartTime] = useState('09:00')
  const [defaultSprintEndTime, setDefaultSprintEndTime] = useState('17:00')

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setDefaultSprintStartTime(settings.defaultSprintStartTime)
      setDefaultSprintEndTime(settings.defaultSprintEndTime)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (defaultSprintStartTime !== settings.defaultSprintStartTime ||
      defaultSprintEndTime !== settings.defaultSprintEndTime)

  const handleSave = () => {
    updateSettings.mutate({ defaultSprintStartTime, defaultSprintEndTime })
  }

  const handleReset = () => {
    if (settings) {
      setDefaultSprintStartTime(settings.defaultSprintStartTime)
      setDefaultSprintEndTime(settings.defaultSprintEndTime)
    }
  }

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: !!hasChanges && !updateSettings.isPending,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">Failed to load settings: {error.message}</div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Default Sprint Times</CardTitle>
          <CardDescription>
            Configure system-wide default times for sprint start and end. New projects will inherit
            these defaults, which can be overridden at the project level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Start Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default Sprint Start Time</Label>
            <div className="max-w-[200px]">
              <TimePicker
                value={defaultSprintStartTime}
                onChange={setDefaultSprintStartTime}
                disabled={updateSettings.isPending}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The default time when sprints start (e.g., 09:00 for 9 AM). This is used as the
              initial value when creating new sprints.
            </p>
          </div>

          {/* Default End Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default Sprint End Time</Label>
            <div className="max-w-[200px]">
              <TimePicker
                value={defaultSprintEndTime}
                onChange={setDefaultSprintEndTime}
                disabled={updateSettings.isPending}
                className="bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The default time when sprints end (e.g., 17:00 for 5 PM). Sprints will be considered
              complete at this time on the end date.
            </p>
          </div>

          {/* Save/Reset buttons */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || updateSettings.isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateSettings.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
