'use client'

import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
    enabled: hasChanges && !updateSettings.isPending,
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
