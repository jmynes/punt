'use client'

import { ArrowRight, ExternalLink, GitBranch, Info, Loader2, Plus, Server, X } from 'lucide-react'
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
import { useCtrlSave } from '@/hooks/use-ctrl-save'
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

// Preset environment suggestions with colors
const ENVIRONMENT_PRESETS = [
  { environment: 'production', branchName: 'main', color: 'rose' },
  { environment: 'staging', branchName: 'staging', color: 'amber' },
  { environment: 'development', branchName: 'develop', color: 'emerald' },
] as const

function getEnvironmentColor(env: string): { bg: string; text: string; border: string } {
  const normalized = env.toLowerCase().trim()
  if (normalized.includes('prod')) {
    return { bg: 'bg-rose-950/50', text: 'text-rose-300', border: 'border-rose-800/50' }
  }
  if (normalized.includes('stag') || normalized.includes('pre')) {
    return { bg: 'bg-amber-950/50', text: 'text-amber-300', border: 'border-amber-800/50' }
  }
  if (normalized.includes('dev') || normalized.includes('local')) {
    return { bg: 'bg-emerald-950/50', text: 'text-emerald-300', border: 'border-emerald-800/50' }
  }
  if (normalized.includes('test') || normalized.includes('qa')) {
    return { bg: 'bg-sky-950/50', text: 'text-sky-300', border: 'border-sky-800/50' }
  }
  return { bg: 'bg-zinc-800/50', text: 'text-zinc-300', border: 'border-zinc-700/50' }
}

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
  ]

  // Branch template presets
  const templatePresets = [
    {
      name: 'Default',
      template: '{type}/{key}-{slug}',
      description: 'e.g., feat/PUNT-42-add-login',
    },
    { name: 'Simple', template: '{key}-{slug}', description: 'e.g., PUNT-42-add-login' },
    { name: 'Flat', template: '{type}-{key}-{slug}', description: 'e.g., feat-PUNT-42-add-login' },
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

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: hasChanges && isValid && !isDisabled,
  })

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
        <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Environment Branches
            </CardTitle>
            <CardDescription>
              Map deployment environments to their corresponding git branches.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {formData.environmentBranches.length === 0 ? (
              /* Empty state */
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent rounded-xl pointer-events-none" />
                <div className="relative flex flex-col items-center py-10 px-4">
                  {/* Visual diagram showing the concept */}
                  <div className="flex items-center gap-3 mb-6 opacity-40">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-950/50 border border-rose-800/30">
                      <span className="text-xs font-medium text-rose-300/70">production</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-600" />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700/30">
                      <GitBranch className="h-3 w-3 text-zinc-500" />
                      <span className="text-xs font-mono text-zinc-400/70">main</span>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 mb-1">No environment mappings configured</p>
                  <p className="text-xs text-zinc-600 mb-5 text-center max-w-[280px]">
                    Define which branches correspond to each deployment environment
                  </p>

                  {!isDisabled && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPresetBranches}
                        className="text-xs bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Common Environments
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Branch list */
              <div className="space-y-2">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2 pr-2">
                    {formData.environmentBranches.map((branch) => {
                      const colors = getEnvironmentColor(branch.environment)
                      const hasValues = branch.environment.trim() || branch.branchName.trim()

                      return (
                        <div
                          key={branch.id}
                          className="group relative flex items-center gap-2 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-150"
                        >
                          {/* Environment input with color indicator */}
                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <Input
                                value={branch.environment}
                                onChange={(e) =>
                                  updateEnvironmentBranch(branch.id, 'environment', e.target.value)
                                }
                                placeholder="environment"
                                disabled={isDisabled}
                                className={`h-9 pl-3 pr-3 bg-zinc-900/60 border text-sm font-medium transition-colors ${
                                  hasValues && branch.environment.trim()
                                    ? `${colors.border} ${colors.text}`
                                    : 'border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600'
                                }`}
                              />
                              {branch.environment.trim() && (
                                <div
                                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${colors.bg.replace('/50', '')}`}
                                />
                              )}
                            </div>
                          </div>

                          {/* Arrow connector */}
                          <div className="flex-shrink-0 flex items-center justify-center w-8">
                            <ArrowRight className="h-4 w-4 text-zinc-600" />
                          </div>

                          {/* Branch input */}
                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                              <Input
                                value={branch.branchName}
                                onChange={(e) =>
                                  updateEnvironmentBranch(branch.id, 'branchName', e.target.value)
                                }
                                placeholder="branch"
                                disabled={isDisabled}
                                className="h-9 pl-8 pr-3 bg-zinc-900/60 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 font-mono text-sm"
                              />
                            </div>
                          </div>

                          {/* Delete button */}
                          {!isDisabled && (
                            <button
                              type="button"
                              onClick={() => removeEnvironmentBranch(branch.id)}
                              className="flex-shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
                              aria-label="Remove mapping"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Add button */}
                {!isDisabled && (
                  <button
                    type="button"
                    onClick={addEnvironmentBranch}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/20 hover:bg-zinc-800/40 border border-dashed border-zinc-800 hover:border-zinc-700 transition-all duration-150"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add mapping
                  </button>
                )}

                {/* Quick add presets hint */}
                {!isDisabled && formData.environmentBranches.length < 3 && (
                  <div className="flex items-center justify-center pt-2">
                    <button
                      type="button"
                      onClick={addPresetBranches}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      + Add missing defaults (prod, staging, dev)
                    </button>
                  </div>
                )}
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

              {/* Template presets */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-zinc-500 mr-1 self-center">Presets:</span>
                {templatePresets.map((preset) => (
                  <Tooltip key={preset.name}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, branchTemplate: preset.template }))
                        }
                        disabled={isDisabled}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.branchTemplate === preset.template
                            ? 'bg-amber-900/50 text-amber-300 border-amber-600/50'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        {preset.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <code className="font-mono">{preset.template}</code>
                      <br />
                      <span className="text-zinc-400">{preset.description}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Variable insert buttons */}
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
                <span className="text-zinc-700 self-center mx-1">|</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => insertVariable('/')}
                      disabled={isDisabled}
                      className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      /
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Path separator
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => insertVariable('-')}
                      disabled={isDisabled}
                      className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Hyphen separator
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
