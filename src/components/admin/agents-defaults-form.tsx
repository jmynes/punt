'use client'

import { Bot, Info, Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { GuidanceEditor } from '@/components/settings/guidance-editor'
import { Button, LoadingButton } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'

export function AgentsDefaultsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [agentGuidance, setAgentGuidance] = useState('')

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setAgentGuidance(settings.defaultAgentGuidance ?? '')
    }
  }, [settings])

  // Check for changes
  const hasChanges = settings && agentGuidance !== (settings.defaultAgentGuidance ?? '')

  const handleSave = useCallback(() => {
    updateSettings.mutate({
      defaultAgentGuidance: agentGuidance || null,
    })
  }, [agentGuidance, updateSettings])

  const handleReset = useCallback(() => {
    if (settings) {
      setAgentGuidance(settings.defaultAgentGuidance ?? '')
    }
  }, [settings])

  const isAtSystemDefaults = !agentGuidance

  const handleResetToSystemDefaults = useCallback(() => {
    setAgentGuidance('')
  }, [])

  const isPending = updateSettings.isPending

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: !!hasChanges && !isPending,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-800 bg-red-900/20">
        <CardContent className="pt-6">
          <p className="text-red-400">Failed to load settings: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToSystemDefaults}
          disabled={isAtSystemDefaults || isPending}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to System Defaults
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-950/30 border border-blue-900/50">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200/80">
          <p className="font-medium text-blue-200 mb-1">Default settings for new projects</p>
          <p>
            These defaults are applied when new projects are created. Individual projects can
            override these in their own settings. Existing projects are not affected.
          </p>
        </div>
      </div>

      {/* Default Agent Guidance Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Default Agent Guidance
          </CardTitle>
          <CardDescription>
            Default Markdown instructions provided to AI agents for new projects. Projects can
            override this in their agent settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="agent-guidance" className="text-zinc-300">
                Instructions
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-zinc-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm">
                  <p>
                    Write Markdown instructions that AI agents will receive by default when working
                    on projects. Include coding conventions, architecture notes, testing
                    requirements, and any organization-wide guidance.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <GuidanceEditor
              markdown={agentGuidance}
              onChange={setAgentGuidance}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save/Reset buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || isPending}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          Reset
        </Button>
        <LoadingButton
          loading={isPending}
          loadingText="Saving..."
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Save Changes
        </LoadingButton>
      </div>
    </div>
  )
}
