'use client'

import { Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button, LoadingButton } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'

export function BoardSettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [showAddColumnButton, setShowAddColumnButton] = useState(true)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setShowAddColumnButton(settings.showAddColumnButton)
    }
  }, [settings])

  const isAtSystemDefaults = showAddColumnButton === true

  const handleResetToSystemDefaults = useCallback(() => {
    setShowAddColumnButton(true)
  }, [])

  const hasChanges = settings && showAddColumnButton !== settings.showAddColumnButton

  const handleSave = () => {
    updateSettings.mutate({ showAddColumnButton })
  }

  const handleReset = () => {
    if (settings) {
      setShowAddColumnButton(settings.showAddColumnButton)
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
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToSystemDefaults}
          disabled={isAtSystemDefaults || updateSettings.isPending}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to System Defaults
        </Button>
      </div>

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
            <LoadingButton
              loading={updateSettings.isPending}
              loadingText="Saving..."
              onClick={handleSave}
              disabled={!hasChanges}
              variant="primary"
            >
              Save Changes
            </LoadingButton>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
