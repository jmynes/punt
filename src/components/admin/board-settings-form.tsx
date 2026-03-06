'use client'

import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import {
  STORY_POINT_SCALE_LABELS,
  STORY_POINT_SCALES,
  type StoryPointScale,
} from '@/lib/story-points'

export function BoardSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [showAddColumnButton, setShowAddColumnButton] = useState(true)
  const [storyPointScale, setStoryPointScale] = useState<StoryPointScale>('sequential')

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setShowAddColumnButton(settings.showAddColumnButton)
      setStoryPointScale(settings.storyPointScale)
    }
  }, [settings])

  const hasChanges =
    settings &&
    (showAddColumnButton !== settings.showAddColumnButton ||
      storyPointScale !== settings.storyPointScale)

  const handleSave = () => {
    updateSettings.mutate({ showAddColumnButton, storyPointScale })
  }

  const handleReset = () => {
    if (settings) {
      setShowAddColumnButton(settings.showAddColumnButton)
      setStoryPointScale(settings.storyPointScale)
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
          <CardTitle className="text-base text-zinc-100">Kanban Board</CardTitle>
          <CardDescription>
            Configure default board behavior across all projects. Individual projects can override
            these settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="showAddColumnButton" className="text-zinc-300 cursor-pointer">
                Show &quot;Add Column&quot; button on boards
              </Label>
              <p className="text-xs text-zinc-500">
                When enabled, users with board management permission will see a button to add new
                columns at the end of the board. Users can individually dismiss this button.
                Projects can override this setting.
              </p>
            </div>
            <Switch
              id="showAddColumnButton"
              checked={showAddColumnButton}
              onCheckedChange={(checked) => setShowAddColumnButton(checked === true)}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>

          {/* Story Point Scale */}
          <div className="space-y-2 pt-2">
            <Label className="text-zinc-300">Story Point Scale</Label>
            <p className="text-xs text-zinc-500">
              Choose the default point scale used across all projects. Individual projects can
              override this setting.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {(Object.keys(STORY_POINT_SCALES) as StoryPointScale[]).map((scale) => (
                <label
                  key={scale}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    storyPointScale === scale
                      ? 'border-amber-600/50 bg-amber-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="storyPointScale"
                    value={scale}
                    checked={storyPointScale === scale}
                    onChange={() => setStoryPointScale(scale)}
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
