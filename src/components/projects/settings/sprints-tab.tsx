'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TimeScroller } from '@/components/ui/time-scroller'
import { useSprintSettings, useUpdateSprintSettings } from '@/hooks/queries/use-sprints'
import { useSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  STORY_POINT_SCALE_LABELS,
  STORY_POINT_SCALES,
  type StoryPointScale,
} from '@/lib/story-points'

type StoryPointScaleOption = 'inherit' | StoryPointScale

interface SprintsTabProps {
  projectId: string
  projectKey: string
}

interface FormData {
  defaultSprintDuration: number
  autoCarryOverIncomplete: boolean
  defaultStartTime: string
  defaultEndTime: string
  storyPointScaleOption: StoryPointScaleOption
}

function toScaleOption(value: string | null | undefined): StoryPointScaleOption {
  if (value === 'sequential' || value === 'fibonacci') return value
  return 'inherit'
}

function fromScaleOption(option: StoryPointScaleOption): string | null {
  if (option === 'inherit') return null
  return option
}

export function SprintsTab({ projectId, projectKey: _projectKey }: SprintsTabProps) {
  const { data: settings, isLoading } = useSprintSettings(projectId)
  const { data: systemSettings } = useSystemSettings()
  const updateSettings = useUpdateSprintSettings(projectId)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)

  const [formData, setFormData] = useState<FormData>({
    defaultSprintDuration: 14,
    autoCarryOverIncomplete: true,
    defaultStartTime: '09:00',
    defaultEndTime: '17:00',
    storyPointScaleOption: 'inherit',
  })

  // Sync form data with fetched settings
  useEffect(() => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration,
        autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
        storyPointScaleOption: toScaleOption(settings.storyPointScale),
      })
    }
  }, [settings])

  const hasChanges =
    settings &&
    (formData.defaultSprintDuration !== settings.defaultSprintDuration ||
      formData.autoCarryOverIncomplete !== settings.autoCarryOverIncomplete ||
      formData.defaultStartTime !== settings.defaultStartTime ||
      formData.defaultEndTime !== settings.defaultEndTime ||
      fromScaleOption(formData.storyPointScaleOption) !== (settings.storyPointScale ?? null))

  const handleSave = useCallback(async () => {
    if (!canEditSettings || !hasChanges) return

    updateSettings.mutate({
      defaultSprintDuration: formData.defaultSprintDuration,
      autoCarryOverIncomplete: formData.autoCarryOverIncomplete,
      defaultStartTime: formData.defaultStartTime,
      defaultEndTime: formData.defaultEndTime,
      storyPointScale: fromScaleOption(formData.storyPointScaleOption),
    })
  }, [canEditSettings, hasChanges, formData, updateSettings])

  const handleReset = useCallback(() => {
    if (settings) {
      setFormData({
        defaultSprintDuration: settings.defaultSprintDuration,
        autoCarryOverIncomplete: settings.autoCarryOverIncomplete,
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
        storyPointScaleOption: toScaleOption(settings.storyPointScale),
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
            <TimeScroller
              value={formData.defaultStartTime}
              onChange={(time) => setFormData((prev) => ({ ...prev, defaultStartTime: time }))}
              disabled={isDisabled}
            />
            <p className="text-xs text-zinc-500">
              The default start time for new sprints (e.g., 09:00 for 9 AM)
            </p>
          </div>

          {/* Default End Time */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Default End Time</Label>
            <TimeScroller
              value={formData.defaultEndTime}
              onChange={(time) => setFormData((prev) => ({ ...prev, defaultEndTime: time }))}
              disabled={isDisabled}
            />
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

          {/* Story Point Scale */}
          <div className="space-y-2 pt-2">
            <Label className="text-zinc-300">Story Point Scale</Label>
            <p className="text-xs text-zinc-500">
              Choose the point scale used for this project. Use &quot;Use global default&quot; to
              follow the system-wide setting
              {systemSettings
                ? ` (currently ${STORY_POINT_SCALE_LABELS[systemSettings.storyPointScale]})`
                : ''}
              .
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {/* Inherit option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  formData.storyPointScaleOption === 'inherit'
                    ? 'border-amber-600/50 bg-amber-950/20'
                    : 'border-zinc-800 hover:border-zinc-700'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="storyPointScale"
                  value="inherit"
                  checked={formData.storyPointScaleOption === 'inherit'}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, storyPointScaleOption: 'inherit' }))
                  }
                  disabled={isDisabled}
                  className="mt-1 accent-amber-600"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-200">Use global default</p>
                  <p className="text-xs text-zinc-500">
                    Follow the system-wide setting configured by admins
                    {systemSettings ? (
                      <span className="font-mono ml-1">
                        ({STORY_POINT_SCALES[systemSettings.storyPointScale].join(', ')})
                      </span>
                    ) : null}
                  </p>
                </div>
              </label>
              {/* Scale options */}
              {(Object.keys(STORY_POINT_SCALES) as StoryPointScale[]).map((scale) => (
                <label
                  key={scale}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    formData.storyPointScaleOption === scale
                      ? 'border-amber-600/50 bg-amber-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="storyPointScale"
                    value={scale}
                    checked={formData.storyPointScaleOption === scale}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, storyPointScaleOption: scale }))
                    }
                    disabled={isDisabled}
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
