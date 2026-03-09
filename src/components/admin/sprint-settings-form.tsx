'use client'

import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TimeScroller } from '@/components/ui/time-scroller'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import {
  STORY_POINT_SCALE_LABELS,
  STORY_POINT_SCALES,
  type StoryPointScale,
} from '@/lib/story-points'

interface FormData {
  defaultSprintDuration: number | ''
  defaultAutoCarryOver: boolean
  defaultSprintStartTime: string
  defaultSprintEndTime: string
  storyPointScale: StoryPointScale
}

export function SprintSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [formData, setFormData] = useState<FormData>({
    defaultSprintDuration: 14,
    defaultAutoCarryOver: true,
    defaultSprintStartTime: '09:00',
    defaultSprintEndTime: '17:00',
    storyPointScale: 'sequential',
  })

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration ?? 14,
        defaultAutoCarryOver: settings.defaultAutoCarryOver ?? true,
        defaultSprintStartTime: settings.defaultSprintStartTime ?? '09:00',
        defaultSprintEndTime: settings.defaultSprintEndTime ?? '17:00',
        storyPointScale: settings.storyPointScale ?? 'sequential',
      })
    }
  }, [settings])

  const hasChanges =
    settings &&
    (formData.defaultSprintDuration !== settings.defaultSprintDuration ||
      formData.defaultAutoCarryOver !== settings.defaultAutoCarryOver ||
      formData.defaultSprintStartTime !== settings.defaultSprintStartTime ||
      formData.defaultSprintEndTime !== settings.defaultSprintEndTime ||
      formData.storyPointScale !== settings.storyPointScale)

  const isValid =
    typeof formData.defaultSprintDuration === 'number' &&
    formData.defaultSprintDuration >= 1 &&
    formData.defaultSprintDuration <= 90

  const handleSave = () => {
    if (!isValid) return
    updateSettings.mutate({
      defaultSprintDuration: formData.defaultSprintDuration,
      defaultAutoCarryOver: formData.defaultAutoCarryOver,
      defaultSprintStartTime: formData.defaultSprintStartTime,
      defaultSprintEndTime: formData.defaultSprintEndTime,
      storyPointScale: formData.storyPointScale,
    })
  }

  const handleReset = () => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration,
        defaultAutoCarryOver: settings.defaultAutoCarryOver,
        defaultSprintStartTime: settings.defaultSprintStartTime,
        defaultSprintEndTime: settings.defaultSprintEndTime,
        storyPointScale: settings.storyPointScale ?? 'sequential',
      })
    }
  }

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: !!hasChanges && isValid && !updateSettings.isPending,
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
          <CardTitle className="text-base text-zinc-100">Sprint Defaults</CardTitle>
          <CardDescription>
            Configure system-wide default sprint settings. New projects will inherit these defaults,
            which can be overridden at the project level.
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
              value={formData.defaultSprintDuration ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setFormData((prev) => ({ ...prev, defaultSprintDuration: '' }))
                  return
                }
                const value = Number.parseInt(raw, 10)
                if (!Number.isNaN(value)) {
                  setFormData((prev) => ({ ...prev, defaultSprintDuration: value }))
                }
              }}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 w-32"
              disabled={updateSettings.isPending}
            />
            <p className="text-xs text-zinc-500">
              The number of days a sprint lasts by default (1-90). This is used as the initial
              duration when creating new sprints.
            </p>
          </div>

          {/* Default Start Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default Sprint Start Time</Label>
            <TimeScroller
              value={formData.defaultSprintStartTime}
              onChange={(time) =>
                setFormData((prev) => ({ ...prev, defaultSprintStartTime: time }))
              }
              disabled={updateSettings.isPending}
            />
            <p className="text-xs text-zinc-500">
              The default time when sprints start (e.g., 09:00 for 9 AM). This is used as the
              initial value when creating new sprints.
            </p>
          </div>

          {/* Default End Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default Sprint End Time</Label>
            <TimeScroller
              value={formData.defaultSprintEndTime}
              onChange={(time) => setFormData((prev) => ({ ...prev, defaultSprintEndTime: time }))}
              disabled={updateSettings.isPending}
            />
            <p className="text-xs text-zinc-500">
              The default time when sprints end (e.g., 17:00 for 5 PM). Sprints will be considered
              complete at this time on the end date.
            </p>
          </div>

          {/* Story Point Scale */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Story Point Scale</Label>
            <p className="text-xs text-zinc-500">
              The default story point scale for new projects. Projects can override this in their
              sprint settings.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {(Object.keys(STORY_POINT_SCALES) as StoryPointScale[]).map((scale) => (
                <label
                  key={scale}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    formData.storyPointScale === scale
                      ? 'border-amber-600/50 bg-amber-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  } ${updateSettings.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="storyPointScale"
                    value={scale}
                    checked={formData.storyPointScale === scale}
                    onChange={() => setFormData((prev) => ({ ...prev, storyPointScale: scale }))}
                    disabled={updateSettings.isPending}
                    className="mt-1 accent-amber-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {STORY_POINT_SCALE_LABELS[scale]}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                      {STORY_POINT_SCALES[scale].join(', ')}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Auto Carryover */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-zinc-300">Auto-carryover incomplete tickets</Label>
              <p className="text-xs text-zinc-500">
                Automatically move incomplete tickets to the next sprint when completing a sprint.
                Projects inherit this default unless overridden.
              </p>
            </div>
            <Switch
              checked={formData.defaultAutoCarryOver}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, defaultAutoCarryOver: checked }))
              }
              disabled={updateSettings.isPending}
            />
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
              disabled={!hasChanges || !isValid || updateSettings.isPending}
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
