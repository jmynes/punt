'use client'

import { ExternalLink, GitBranch, GripVertical, Info, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type EnvironmentBranch,
  useRepositoryConfig,
  useUpdateRepository,
} from '@/hooks/queries/use-repository'
import { useHasPermission } from '@/hooks/use-permissions'
import { previewBranchName, validateBranchTemplate } from '@/lib/branch-utils'
import { PERMISSIONS } from '@/lib/permissions'

interface RepositoryTabProps {
  projectId: string
  projectKey: string
}

interface FormData {
  repositoryUrl: string
  localPath: string
  defaultBranch: string
  branchTemplate: string
  monorepoPath: string
  environmentBranches: EnvironmentBranch[]
}

// Preset environment suggestions
const ENVIRONMENT_PRESETS = [
  { environment: 'production', branchName: 'main' },
  { environment: 'staging', branchName: 'staging' },
  { environment: 'development', branchName: 'develop' },
]

export function RepositoryTab({ projectId, projectKey }: RepositoryTabProps) {
  const { data: config, isLoading } = useRepositoryConfig(projectKey)
  const updateRepository = useUpdateRepository(projectKey)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)

  const [formData, setFormData] = useState<FormData>({
    repositoryUrl: '',
    localPath: '',
    defaultBranch: '',
    branchTemplate: '',
    monorepoPath: '',
    environmentBranches: [],
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [branchTemplateError, setBranchTemplateError] = useState<string | null>(null)
  const branchInputRef = useRef<HTMLInputElement>(null)

  // Template variables that can be inserted
  const templateVariables = [
    { name: '{type}', description: 'Ticket type (bug, feat, etc.)' },
    { name: '{key}', description: 'Full ticket key (e.g., PUNT-42)' },
    { name: '{number}', description: 'Ticket number only (e.g., 42)' },
    { name: '{slug}', description: 'Slugified ticket title' },
    { name: '{project}', description: 'Project key (e.g., PUNT)' },
    { name: '/', description: 'Path separator' },
    { name: '-', description: 'Hyphen separator' },
  ]

  // Insert a variable at the cursor position
  const insertVariable = useCallback(
    (variable: string) => {
      const input = branchInputRef.current
      if (!input) return

      const start = input.selectionStart ?? formData.branchTemplate.length
      const end = input.selectionEnd ?? formData.branchTemplate.length
      const newValue =
        formData.branchTemplate.slice(0, start) + variable + formData.branchTemplate.slice(end)

      setFormData((prev) => ({ ...prev, branchTemplate: newValue }))

      // Restore focus and set cursor after the inserted variable
      requestAnimationFrame(() => {
        input.focus()
        const newCursorPos = start + variable.length
        input.setSelectionRange(newCursorPos, newCursorPos)
      })
    },
    [formData.branchTemplate],
  )

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        repositoryUrl: config.repositoryUrl || '',
        localPath: config.localPath || '',
        defaultBranch: config.defaultBranch || '',
        branchTemplate: config.branchTemplate || '',
        monorepoPath: config.monorepoPath || '',
        environmentBranches: config.environmentBranches || [],
      })
      setHasChanges(false)
    }
  }, [config])

  // Track changes
  useEffect(() => {
    if (!config) return

    const configBranches = config.environmentBranches || []
    const branchesChanged =
      formData.environmentBranches.length !== configBranches.length ||
      formData.environmentBranches.some((b, i) => {
        const orig = configBranches[i]
        return !orig || b.environment !== orig.environment || b.branchName !== orig.branchName
      })

    const changed =
      formData.repositoryUrl !== (config.repositoryUrl || '') ||
      formData.localPath !== (config.localPath || '') ||
      formData.defaultBranch !== (config.defaultBranch || '') ||
      formData.branchTemplate !== (config.branchTemplate || '') ||
      formData.monorepoPath !== (config.monorepoPath || '') ||
      branchesChanged

    setHasChanges(changed)
  }, [formData, config])

  // Validate branch template
  useEffect(() => {
    if (formData.branchTemplate) {
      const error = validateBranchTemplate(formData.branchTemplate)
      setBranchTemplateError(error)
    } else {
      setBranchTemplateError(null)
    }
  }, [formData.branchTemplate])

  const handleSave = useCallback(async () => {
    if (!canEditSettings) return

    updateRepository.mutate({
      repositoryUrl: formData.repositoryUrl || null,
      localPath: formData.localPath || null,
      defaultBranch: formData.defaultBranch || null,
      branchTemplate: formData.branchTemplate || null,
      monorepoPath: formData.monorepoPath || null,
      environmentBranches:
        formData.environmentBranches.length > 0 ? formData.environmentBranches : null,
    })
  }, [canEditSettings, formData, updateRepository])

  const handleReset = useCallback(() => {
    if (config) {
      setFormData({
        repositoryUrl: config.repositoryUrl || '',
        localPath: config.localPath || '',
        defaultBranch: config.defaultBranch || '',
        branchTemplate: config.branchTemplate || '',
        monorepoPath: config.monorepoPath || '',
        environmentBranches: config.environmentBranches || [],
      })
    }
  }, [config])

  // Environment branch handlers
  const addEnvironmentBranch = useCallback(() => {
    const newBranch: EnvironmentBranch = {
      id: crypto.randomUUID(),
      environment: '',
      branchName: '',
    }
    setFormData((prev) => ({
      ...prev,
      environmentBranches: [...prev.environmentBranches, newBranch],
    }))
  }, [])

  const updateEnvironmentBranch = useCallback(
    (id: string, field: 'environment' | 'branchName', value: string) => {
      setFormData((prev) => ({
        ...prev,
        environmentBranches: prev.environmentBranches.map((b) =>
          b.id === id ? { ...b, [field]: value } : b,
        ),
      }))
    },
    [],
  )

  const removeEnvironmentBranch = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      environmentBranches: prev.environmentBranches.filter((b) => b.id !== id),
    }))
  }, [])

  const addPresetBranches = useCallback(() => {
    const existingEnvs = new Set(
      formData.environmentBranches.map((b) => b.environment.toLowerCase()),
    )
    const newBranches = ENVIRONMENT_PRESETS.filter(
      (p) => !existingEnvs.has(p.environment.toLowerCase()),
    ).map((p) => ({
      id: crypto.randomUUID(),
      environment: p.environment,
      branchName: p.branchName,
    }))

    if (newBranches.length > 0) {
      setFormData((prev) => ({
        ...prev,
        environmentBranches: [...prev.environmentBranches, ...newBranches],
      }))
    }
  }, [formData.environmentBranches])

  const isPending = updateRepository.isPending
  const isDisabled = !canEditSettings || isPending
  const isValid = !branchTemplateError

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
          <h3 className="text-lg font-medium text-zinc-100">Repository</h3>
          <p className="text-sm text-zinc-500">
            Configure the external repository this project manages.
          </p>
        </div>

        {/* Repository Details Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Repository Connection</CardTitle>
            <CardDescription>
              Link this project to a Git repository for AI agent context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Repository URL */}
            <div className="space-y-2">
              <Label htmlFor="repository-url" className="text-zinc-300">
                Repository URL
              </Label>
              <Input
                id="repository-url"
                value={formData.repositoryUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, repositoryUrl: e.target.value }))
                }
                placeholder="https://github.com/owner/repo"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                disabled={isDisabled}
              />
              <p className="text-xs text-zinc-500">
                The HTTPS URL for the repository (e.g., GitHub, GitLab, Bitbucket).
              </p>
            </div>

            {/* Default Branch */}
            <div className="space-y-2">
              <Label htmlFor="default-branch" className="text-zinc-300">
                Default Branch
              </Label>
              <Input
                id="default-branch"
                value={formData.defaultBranch}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, defaultBranch: e.target.value }))
                }
                placeholder="main"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                disabled={isDisabled}
              />
              <p className="text-xs text-zinc-500">
                The primary branch name (e.g., main, master, develop).
              </p>
            </div>

            {/* Local Path */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="local-path" className="text-zinc-300">
                  Local Path
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-zinc-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>
                      The absolute filesystem path where the repository is cloned locally. AI agents
                      use this to navigate the codebase.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="local-path"
                value={formData.localPath}
                onChange={(e) => setFormData((prev) => ({ ...prev, localPath: e.target.value }))}
                placeholder="/home/user/projects/my-repo"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                disabled={isDisabled}
              />
            </div>

            {/* Monorepo Path */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="monorepo-path" className="text-zinc-300">
                  Monorepo Path
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-zinc-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>
                      If this project manages a specific package within a monorepo, specify the
                      relative path (e.g., &quot;packages/frontend&quot;).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="monorepo-path"
                value={formData.monorepoPath}
                onChange={(e) => setFormData((prev) => ({ ...prev, monorepoPath: e.target.value }))}
                placeholder="packages/frontend"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                disabled={isDisabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Environment Branches Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Environment Branches
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Define branches for different deployment environments.
                </CardDescription>
              </div>
              {!isDisabled && (
                <div className="flex items-center gap-2">
                  {formData.environmentBranches.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPresetBranches}
                      className="text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    >
                      Add Defaults
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEnvironmentBranch}
                    className="text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Branch
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {formData.environmentBranches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
                  <GitBranch className="h-5 w-5 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 mb-1">No environment branches configured</p>
                <p className="text-xs text-zinc-600">
                  Add branches to track deployments across environments
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2 pr-3">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr,1fr,40px] gap-3 px-1 pb-2 border-b border-zinc-800/50">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Environment
                    </span>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Branch Name
                    </span>
                    <span />
                  </div>

                  {/* Branch rows */}
                  {formData.environmentBranches.map((branch, index) => (
                    <div
                      key={branch.id}
                      className="group grid grid-cols-[1fr,1fr,40px] gap-3 items-center p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                        <Input
                          value={branch.environment}
                          onChange={(e) =>
                            updateEnvironmentBranch(branch.id, 'environment', e.target.value)
                          }
                          placeholder="e.g., production"
                          disabled={isDisabled}
                          className="h-8 bg-zinc-900/50 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 text-sm focus:border-amber-600/50 focus:ring-amber-600/20"
                        />
                      </div>
                      <div className="flex items-center">
                        <Input
                          value={branch.branchName}
                          onChange={(e) =>
                            updateEnvironmentBranch(branch.id, 'branchName', e.target.value)
                          }
                          placeholder="e.g., main"
                          disabled={isDisabled}
                          className="h-8 bg-zinc-900/50 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 font-mono text-sm focus:border-amber-600/50 focus:ring-amber-600/20"
                        />
                      </div>
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEnvironmentBranch(branch.id)}
                          disabled={isDisabled}
                          className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {formData.environmentBranches.length > 0 && !isDisabled && (
              <div className="mt-3 pt-3 border-t border-zinc-800/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addEnvironmentBranch}
                  className="w-full h-8 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-dashed border-zinc-800 hover:border-zinc-700"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add another branch
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch Naming Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Branch Naming
            </CardTitle>
            <CardDescription>
              Configure how branch names are generated for tickets in this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Branch Template */}
            <div className="space-y-2">
              <Label htmlFor="branch-template" className="text-zinc-300">
                Branch Name Template
              </Label>
              <Input
                ref={branchInputRef}
                id="branch-template"
                value={formData.branchTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, branchTemplate: e.target.value }))
                }
                placeholder={config?.systemDefaults.branchTemplate || '{type}/{key}-{slug}'}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                disabled={isDisabled}
              />
              {branchTemplateError && <p className="text-xs text-red-400">{branchTemplateError}</p>}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-zinc-500 mr-1 self-center">Insert:</span>
                {templateVariables.map((v) => (
                  <Tooltip key={v.name}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => insertVariable(v.name)}
                        disabled={isDisabled}
                        className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {v.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {v.description}
                    </TooltipContent>
                  </Tooltip>
                ))}
                <span className="text-zinc-700 self-center">|</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, branchTemplate: '{type}/{key}-{slug}' }))
                      }
                      disabled={isDisabled}
                      className="px-2 py-0.5 text-xs rounded bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 hover:text-amber-300 border border-amber-700/50 hover:border-amber-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Default
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Use default pattern: {'{type}/{key}-{slug}'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-zinc-500">Leave empty to use the system default.</p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Preview</Label>
              <div className="flex items-center gap-2 p-3 rounded-md bg-zinc-800/50 border border-zinc-800">
                <GitBranch className="h-4 w-4 text-zinc-500" />
                <code className="text-sm text-amber-400 font-mono">
                  {previewBranchName(
                    formData.branchTemplate ||
                      config?.effectiveBranchTemplate ||
                      '{type}/{key}-{slug}',
                    {
                      projectKey: projectKey,
                      ticketNumber: 42,
                      ticketType: 'bug',
                      ticketTitle: 'Fix login button not working',
                    },
                  )}
                </code>
              </div>
            </div>

            {config?.systemDefaults.branchTemplate && !formData.branchTemplate && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-950/30 border border-blue-900/50">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200/80">
                  <p>
                    Using system default:{' '}
                    <code className="font-mono text-blue-300">
                      {config.systemDefaults.branchTemplate}
                    </code>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* External Link */}
        {formData.repositoryUrl && (
          <div className="pt-4 border-t border-zinc-800">
            <a
              href={formData.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open repository in browser
            </a>
          </div>
        )}
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
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!isValid || isPending}
            >
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
