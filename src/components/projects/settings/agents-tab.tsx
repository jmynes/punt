'use client'

import { Bot, Copy, Info, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRepositoryConfig, useUpdateRepository } from '@/hooks/queries/use-repository'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { showToast } from '@/lib/toast'

interface AgentsTabProps {
  projectId: string
  projectKey: string
}

export function AgentsTab({ projectId, projectKey }: AgentsTabProps) {
  const { data: config, isLoading } = useRepositoryConfig(projectKey)
  const updateRepository = useUpdateRepository(projectKey)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)

  const [agentGuidance, setAgentGuidance] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setAgentGuidance(config.agentGuidance || '')
      setHasChanges(false)
    }
  }, [config])

  // Track changes
  useEffect(() => {
    if (!config) return
    const changed = agentGuidance !== (config.agentGuidance || '')
    setHasChanges(changed)
  }, [agentGuidance, config])

  const handleSave = useCallback(async () => {
    if (!canEditSettings) return

    updateRepository.mutate({
      agentGuidance: agentGuidance || null,
    })
  }, [canEditSettings, agentGuidance, updateRepository])

  const handleReset = useCallback(() => {
    if (config) {
      setAgentGuidance(config.agentGuidance || '')
    }
  }, [config])

  const handleCopyContext = useCallback(() => {
    const context = [
      `# Project: ${config?.projectName} (${config?.projectKey})`,
      '',
      config?.repositoryUrl && `Repository: ${config.repositoryUrl}`,
      config?.localPath && `Local Path: ${config.localPath}`,
      config?.defaultBranch && `Default Branch: ${config.defaultBranch}`,
      config?.monorepoPath && `Monorepo Path: ${config.monorepoPath}`,
      '',
      config?.effectiveBranchTemplate && `Branch Template: ${config.effectiveBranchTemplate}`,
      '',
      config?.effectiveAgentGuidance && '## Agent Guidance',
      config?.effectiveAgentGuidance,
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard.writeText(context)
    showToast.success('Context copied to clipboard')
  }, [config])

  const isPending = updateRepository.isPending
  const isDisabled = !canEditSettings || isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-6 pb-4">
        <div>
          <h3 className="text-lg font-medium text-zinc-100">AI Agents</h3>
          <p className="text-sm text-zinc-500">
            Configure guidance and context for AI agents working on this project.
          </p>
        </div>

        {/* Agent Guidance Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agent Guidance
            </CardTitle>
            <CardDescription>
              Markdown instructions provided to AI agents when they work on tickets in this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agent Guidance Textarea */}
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
                      Write Markdown instructions that AI agents will receive when working on this
                      project. Include coding conventions, architecture notes, testing requirements,
                      and any project-specific guidance.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="agent-guidance"
                value={agentGuidance}
                onChange={(e) => setAgentGuidance(e.target.value)}
                placeholder={`Example:

## Coding Conventions
- Use TypeScript strict mode
- Follow React 19 patterns
- All components must have tests

## Architecture
- Use React Query for data fetching
- State management with Zustand
- Tailwind CSS for styling

## Testing
- Run \`pnpm test\` before committing
- Coverage must stay above 80%`}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm min-h-[300px] resize-y"
                disabled={isDisabled}
              />
            </div>

            {config?.systemDefaults.agentGuidance && !agentGuidance && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-950/30 border border-blue-900/50">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200/80">
                  <p className="font-medium mb-1">Using system default guidance:</p>
                  <pre className="whitespace-pre-wrap font-mono text-blue-300/80 text-xs max-h-32 overflow-auto">
                    {config.systemDefaults.agentGuidance}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Context Preview Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-zinc-100">Context Preview</CardTitle>
                <CardDescription>
                  This is the context that AI agents will receive via the MCP server.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyContext}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Context
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 max-h-64 overflow-auto">
              <div className="space-y-2">
                <div className="text-amber-400">
                  # Project: {config?.projectName} ({config?.projectKey})
                </div>
                {config?.repositoryUrl && (
                  <div>
                    <span className="text-zinc-500">Repository:</span> {config.repositoryUrl}
                  </div>
                )}
                {config?.localPath && (
                  <div>
                    <span className="text-zinc-500">Local Path:</span> {config.localPath}
                  </div>
                )}
                {config?.defaultBranch && (
                  <div>
                    <span className="text-zinc-500">Default Branch:</span> {config.defaultBranch}
                  </div>
                )}
                {config?.monorepoPath && (
                  <div>
                    <span className="text-zinc-500">Monorepo Path:</span> {config.monorepoPath}
                  </div>
                )}
                {config?.effectiveBranchTemplate && (
                  <div>
                    <span className="text-zinc-500">Branch Template:</span>{' '}
                    {config.effectiveBranchTemplate}
                  </div>
                )}
                {config?.effectiveAgentGuidance && (
                  <>
                    <div className="text-amber-400 mt-4">## Agent Guidance</div>
                    <pre className="whitespace-pre-wrap text-zinc-300">
                      {config.effectiveAgentGuidance}
                    </pre>
                  </>
                )}
                {!config?.repositoryUrl &&
                  !config?.localPath &&
                  !config?.effectiveAgentGuidance && (
                    <div className="text-zinc-500 italic">
                      No repository or agent guidance configured yet.
                    </div>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer with save/cancel */}
      {canEditSettings && hasChanges && (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
          <p className="text-sm text-zinc-400">You have unsaved changes</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isPending}>
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
        </div>
      )}
    </div>
  )
}
