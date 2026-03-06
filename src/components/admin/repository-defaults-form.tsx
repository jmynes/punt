'use client'

import {
  ArrowRight,
  Bot,
  GitBranch,
  GitCommitHorizontal,
  Info,
  Loader2,
  Palette,
  Plus,
  Save,
  Server,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ColorPickerBody } from '@/components/tickets/label-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { previewBranchName, validateBranchTemplate } from '@/lib/branch-utils'

// Types matching those in use-repository.ts
interface EnvironmentBranch {
  id: string
  environment: string
  branchName: string
  color?: string
}

type CommitPatternAction = 'close' | 'in_progress' | 'reference'

interface CommitPattern {
  id: string
  pattern: string
  action: CommitPatternAction
  isRegex?: boolean
  enabled?: boolean
  keywords?: string[]
}

// Default colors for new environment branches
const DEFAULT_ENVIRONMENT_COLORS = [
  '#ef4444', // red
  '#fbbf24', // amber
  '#4ade80', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#fb923c', // orange
]

// Preset environment suggestions with colors
const ENVIRONMENT_PRESETS = [
  { environment: 'production', branchName: 'main', color: '#ef4444' },
  { environment: 'staging', branchName: 'staging', color: '#fbbf24' },
  { environment: 'development', branchName: 'develop', color: '#4ade80' },
] as const

// Branch template variables
const TEMPLATE_VARIABLES = [
  { name: '{type}', description: 'Ticket type (bug, feat, etc.)' },
  { name: '{key}', description: 'Full ticket key (e.g., PROJ-42)' },
  { name: '{number}', description: 'Ticket number only (e.g., 42)' },
  { name: '{slug}', description: 'Slugified ticket title' },
  { name: '{project}', description: 'Project key (e.g., PROJ)' },
]

// Branch template presets
const TEMPLATE_PRESETS = [
  { name: 'Default', template: '{type}/{key}-{slug}', description: 'e.g., feat/PROJ-42-add-login' },
  { name: 'Simple', template: '{key}-{slug}', description: 'e.g., PROJ-42-add-login' },
  { name: 'Flat', template: '{type}-{key}-{slug}', description: 'e.g., feat-PROJ-42-add-login' },
]

// Commit pattern action configuration
const PATTERN_ACTIONS: {
  value: CommitPatternAction
  label: string
  description: string
  accent: string
  accentMuted: string
}[] = [
  {
    value: 'close',
    label: 'Close',
    description: 'Move ticket to Done',
    accent: 'text-emerald-400',
    accentMuted: 'text-emerald-500/70',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    description: 'Move ticket to In Progress',
    accent: 'text-amber-400',
    accentMuted: 'text-amber-500/70',
  },
  {
    value: 'reference',
    label: 'Reference',
    description: 'Log commit reference only',
    accent: 'text-sky-400',
    accentMuted: 'text-sky-500/70',
  },
]

const DEFAULT_COMMIT_PATTERNS: CommitPattern[] = [
  { id: '1', pattern: 'fixes', keywords: ['closes', 'resolves'], action: 'close', enabled: true },
  { id: '2', pattern: 'wip', action: 'in_progress', enabled: true },
]

function getActionConfig(action: CommitPatternAction) {
  return PATTERN_ACTIONS.find((a) => a.value === action) ?? PATTERN_ACTIONS[2]
}

interface FormData {
  branchTemplate: string
  agentGuidance: string
  environmentBranches: EnvironmentBranch[]
  commitPatterns: CommitPattern[]
}

export function RepositoryDefaultsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [formData, setFormData] = useState<FormData>({
    branchTemplate: '{type}/{key}-{slug}',
    agentGuidance: '',
    environmentBranches: [],
    commitPatterns: [],
  })
  const [branchTemplateError, setBranchTemplateError] = useState<string | null>(null)
  const branchInputRef = useRef<HTMLInputElement>(null)

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        branchTemplate: settings.defaultBranchTemplate ?? '{type}/{key}-{slug}',
        agentGuidance: settings.defaultAgentGuidance ?? '',
        environmentBranches: Array.isArray(settings.defaultEnvironmentBranches)
          ? (settings.defaultEnvironmentBranches as EnvironmentBranch[])
          : [],
        commitPatterns: Array.isArray(settings.defaultCommitPatterns)
          ? (settings.defaultCommitPatterns as CommitPattern[])
          : [],
      })
    }
  }, [settings])

  // Validate branch template
  useEffect(() => {
    if (formData.branchTemplate) {
      const error = validateBranchTemplate(formData.branchTemplate)
      setBranchTemplateError(error)
    } else {
      setBranchTemplateError(null)
    }
  }, [formData.branchTemplate])

  // Check for changes
  const hasChanges =
    settings &&
    (formData.branchTemplate !== (settings.defaultBranchTemplate ?? '{type}/{key}-{slug}') ||
      formData.agentGuidance !== (settings.defaultAgentGuidance ?? '') ||
      JSON.stringify(formData.environmentBranches) !==
        JSON.stringify(
          Array.isArray(settings.defaultEnvironmentBranches)
            ? settings.defaultEnvironmentBranches
            : [],
        ) ||
      JSON.stringify(formData.commitPatterns) !==
        JSON.stringify(
          Array.isArray(settings.defaultCommitPatterns) ? settings.defaultCommitPatterns : [],
        ))

  const handleSave = useCallback(() => {
    if (branchTemplateError) return

    updateSettings.mutate({
      defaultBranchTemplate: formData.branchTemplate,
      defaultAgentGuidance: formData.agentGuidance || null,
      defaultEnvironmentBranches:
        formData.environmentBranches.length > 0 ? formData.environmentBranches : null,
      defaultCommitPatterns: formData.commitPatterns.length > 0 ? formData.commitPatterns : null,
    })
  }, [formData, branchTemplateError, updateSettings])

  const handleReset = useCallback(() => {
    if (settings) {
      setFormData({
        branchTemplate: settings.defaultBranchTemplate ?? '{type}/{key}-{slug}',
        agentGuidance: settings.defaultAgentGuidance ?? '',
        environmentBranches: Array.isArray(settings.defaultEnvironmentBranches)
          ? (settings.defaultEnvironmentBranches as EnvironmentBranch[])
          : [],
        commitPatterns: Array.isArray(settings.defaultCommitPatterns)
          ? (settings.defaultCommitPatterns as CommitPattern[])
          : [],
      })
    }
  }, [settings])

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

      requestAnimationFrame(() => {
        input.focus()
        const newCursorPos = start + variable.length
        input.setSelectionRange(newCursorPos, newCursorPos)
      })
    },
    [formData.branchTemplate],
  )

  // Environment branch handlers
  const addEnvironmentBranch = useCallback(() => {
    setFormData((prev) => {
      const nextColorIndex = prev.environmentBranches.length % DEFAULT_ENVIRONMENT_COLORS.length
      const newBranch: EnvironmentBranch = {
        id: crypto.randomUUID(),
        environment: '',
        branchName: '',
        color: DEFAULT_ENVIRONMENT_COLORS[nextColorIndex],
      }
      return {
        ...prev,
        environmentBranches: [...prev.environmentBranches, newBranch],
      }
    })
  }, [])

  const updateEnvironmentBranch = useCallback(
    (id: string, field: 'environment' | 'branchName' | 'color', value: string) => {
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
      color: p.color,
    }))

    if (newBranches.length > 0) {
      setFormData((prev) => ({
        ...prev,
        environmentBranches: [...prev.environmentBranches, ...newBranches],
      }))
    }
  }, [formData.environmentBranches])

  // Commit pattern handlers
  const addPattern = useCallback(() => {
    const newPattern: CommitPattern = {
      id: crypto.randomUUID(),
      pattern: '',
      action: 'reference',
      enabled: true,
    }
    setFormData((prev) => ({
      ...prev,
      commitPatterns: [...prev.commitPatterns, newPattern],
    }))
  }, [])

  const updatePattern = useCallback(
    (id: string, field: keyof CommitPattern, value: string | boolean | string[]) => {
      setFormData((prev) => ({
        ...prev,
        commitPatterns: prev.commitPatterns.map((p) =>
          p.id === id ? { ...p, [field]: value } : p,
        ),
      }))
    },
    [],
  )

  const removePattern = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      commitPatterns: prev.commitPatterns.filter((p) => p.id !== id),
    }))
  }, [])

  const addKeyword = useCallback((id: string, keyword: string) => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return
    setFormData((prev) => ({
      ...prev,
      commitPatterns: prev.commitPatterns.map((p) => {
        if (p.id !== id) return p
        if (!p.pattern) {
          return { ...p, pattern: trimmed }
        }
        if (p.pattern.toLowerCase() === trimmed) return p
        if (p.keywords?.some((k) => k.toLowerCase() === trimmed)) return p
        return { ...p, keywords: [...(p.keywords ?? []), trimmed] }
      }),
    }))
  }, [])

  const removeKeyword = useCallback((id: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      commitPatterns: prev.commitPatterns
        .map((p) => {
          if (p.id !== id) return p
          if (index === 0) {
            if (p.keywords && p.keywords.length > 0) {
              const [newPrimary, ...rest] = p.keywords
              return { ...p, pattern: newPrimary, keywords: rest.length > 0 ? rest : undefined }
            }
            return null // Remove entire pattern
          }
          const keywords = [...(p.keywords ?? [])]
          keywords.splice(index - 1, 1)
          return { ...p, keywords: keywords.length > 0 ? keywords : undefined }
        })
        .filter(Boolean) as CommitPattern[],
    }))
  }, [])

  const loadDefaultPatterns = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      commitPatterns: DEFAULT_COMMIT_PATTERNS.map((p) => ({ ...p, id: crypto.randomUUID() })),
    }))
  }, [])

  const isValid = !branchTemplateError
  const isPending = updateSettings.isPending

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: !!hasChanges && isValid && !isPending,
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

      {/* Branch Naming Card */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Default Branch Template
          </CardTitle>
          <CardDescription>
            The default branch naming template applied to new projects. Projects can override this
            in their repository settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-template" className="text-zinc-300">
              Branch Name Template
            </Label>
            <Input
              ref={branchInputRef}
              id="branch-template"
              value={formData.branchTemplate}
              onChange={(e) => setFormData((prev) => ({ ...prev, branchTemplate: e.target.value }))}
              placeholder="{type}/{key}-{slug}"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
              disabled={isPending}
            />
            {branchTemplateError && <p className="text-xs text-red-400">{branchTemplateError}</p>}

            {/* Template presets */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-zinc-500 mr-1 self-center">Presets:</span>
              {TEMPLATE_PRESETS.map((preset) => (
                <Tooltip key={preset.name}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, branchTemplate: preset.template }))
                      }
                      disabled={isPending}
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
              {TEMPLATE_VARIABLES.map((v) => (
                <Tooltip key={v.name}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => insertVariable(v.name)}
                      disabled={isPending}
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
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Preview</Label>
            <div className="flex items-center gap-2 p-3 rounded-md bg-zinc-800/50 border border-zinc-800">
              <GitBranch className="h-4 w-4 text-zinc-500" />
              <code className="text-sm text-amber-400 font-mono">
                {previewBranchName(formData.branchTemplate || '{type}/{key}-{slug}', {
                  projectKey: 'PROJ',
                  ticketNumber: 42,
                  ticketType: 'bug',
                  ticketTitle: 'Fix login button not working',
                })}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Environment Branches Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
            <Server className="h-4 w-4" />
            Default Environment Branches
          </CardTitle>
          <CardDescription>
            Default environment-to-branch mappings applied to new projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {formData.environmentBranches.length === 0 ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent rounded-xl pointer-events-none" />
              <div className="relative flex flex-col items-center py-10 px-4">
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
                <p className="text-sm text-zinc-400 mb-1">No default environment mappings</p>
                <p className="text-xs text-zinc-600 mb-5 text-center max-w-[280px]">
                  New projects will start without environment mappings unless you configure defaults
                  here.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPresetBranches}
                  disabled={isPending}
                  className="text-xs bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Common Environments
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-2">
                  {formData.environmentBranches.map((branch) => (
                    <div
                      key={branch.id}
                      className="group relative flex items-center gap-2 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-150"
                    >
                      <div className="flex-1 min-w-0">
                        <Input
                          value={branch.environment}
                          onChange={(e) =>
                            updateEnvironmentBranch(branch.id, 'environment', e.target.value)
                          }
                          placeholder="environment"
                          disabled={isPending}
                          className="h-9 pl-3 pr-3 bg-zinc-900/60 border-zinc-700/50 text-zinc-200 text-sm font-medium"
                          style={
                            branch.color
                              ? { borderLeftColor: branch.color, borderLeftWidth: '3px' }
                              : undefined
                          }
                        />
                      </div>

                      <div className="flex-shrink-0 flex items-center justify-center w-8">
                        <ArrowRight className="h-4 w-4 text-zinc-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                          <Input
                            value={branch.branchName}
                            onChange={(e) =>
                              updateEnvironmentBranch(branch.id, 'branchName', e.target.value)
                            }
                            placeholder="branch"
                            disabled={isPending}
                            className="h-9 pl-8 pr-3 bg-zinc-900/60 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 font-mono text-sm"
                          />
                        </div>
                      </div>

                      {/* Color picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex-shrink-0 p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
                            aria-label="Change color"
                          >
                            {branch.color ? (
                              <div
                                className="h-4 w-4 rounded-full border border-zinc-600"
                                style={{ backgroundColor: branch.color }}
                              />
                            ) : (
                              <Palette className="h-4 w-4" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="end"
                          className="w-[280px] px-3 py-0 bg-zinc-900 border-zinc-700"
                        >
                          <ColorPickerBody
                            activeColor={branch.color ?? DEFAULT_ENVIRONMENT_COLORS[0]}
                            onColorChange={(color) =>
                              updateEnvironmentBranch(branch.id, 'color', color)
                            }
                            extraPresets={DEFAULT_ENVIRONMENT_COLORS}
                          />
                        </PopoverContent>
                      </Popover>

                      <button
                        type="button"
                        onClick={() => removeEnvironmentBranch(branch.id)}
                        disabled={isPending}
                        className="flex-shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
                        aria-label="Remove mapping"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <button
                type="button"
                onClick={addEnvironmentBranch}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/20 hover:bg-zinc-800/40 border border-dashed border-zinc-800 hover:border-zinc-700 transition-all duration-150"
              >
                <Plus className="h-3.5 w-3.5" />
                Add mapping
              </button>

              {formData.environmentBranches.length < 3 && (
                <div className="flex items-center justify-center pt-2">
                  <button
                    type="button"
                    onClick={addPresetBranches}
                    disabled={isPending}
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

      {/* Default Commit Patterns Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4" />
                Default Commit Patterns
              </CardTitle>
              <CardDescription className="mt-1">
                Default commit patterns applied to new projects for webhook-based ticket automation.
              </CardDescription>
            </div>
            {formData.commitPatterns.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadDefaultPatterns}
                disabled={isPending}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Load Defaults
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {formData.commitPatterns.length === 0 ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent rounded-xl pointer-events-none" />
              <div className="relative flex flex-col items-center py-10 px-4">
                <div className="flex items-center gap-2 mb-6 opacity-40">
                  <div className="px-3 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/50 font-mono text-xs text-zinc-400">
                    fixes PROJ-42
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/50 border border-emerald-800/30">
                    <span className="text-xs text-emerald-300/70">Done</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 mb-1">No default commit patterns</p>
                <p className="text-xs text-zinc-600 text-center max-w-[300px]">
                  New projects will start without custom commit patterns unless you configure
                  defaults here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-1.5 pr-2">
                  {formData.commitPatterns.map((pattern) => {
                    const actionConfig = getActionConfig(pattern.action)
                    const allKeywords = [pattern.pattern, ...(pattern.keywords ?? [])].filter(
                      Boolean,
                    )

                    return (
                      <div
                        key={pattern.id}
                        className={`group relative flex flex-col gap-2 p-2.5 rounded-md border transition-all duration-150 ${
                          pattern.enabled !== false
                            ? 'bg-zinc-800/40 border-zinc-700/50 hover:border-zinc-600/50'
                            : 'bg-zinc-900/30 border-zinc-800/30 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-1 self-stretch rounded-full ${actionConfig.accent.replace('text-', 'bg-')}`}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {allKeywords.map((kw, idx) => (
                                <span
                                  key={`${kw}-${idx}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-700/60 border border-zinc-600/40 text-zinc-200 font-mono text-xs"
                                >
                                  {kw}
                                  <button
                                    type="button"
                                    onClick={() => removeKeyword(pattern.id, idx)}
                                    disabled={isPending}
                                    className="ml-0.5 rounded-full hover:bg-zinc-500/40 hover:text-rose-300 transition-colors"
                                    aria-label={`Remove keyword "${kw}"`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}

                              <KeywordInput
                                patternId={pattern.id}
                                onAdd={addKeyword}
                                existingKeywords={allKeywords}
                              />
                            </div>
                          </div>

                          {/* Action selector */}
                          <div className="flex items-center gap-0.5 p-1 rounded-md bg-zinc-900/50">
                            {PATTERN_ACTIONS.map((action) => {
                              const isSelected = pattern.action === action.value
                              return (
                                <Tooltip key={action.value} delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePattern(pattern.id, 'action', action.value)
                                      }
                                      disabled={isPending}
                                      className={`p-1.5 rounded transition-all duration-100 disabled:opacity-50 ${
                                        isSelected
                                          ? `${action.accent} bg-zinc-800`
                                          : `${action.accentMuted} hover:bg-zinc-800/50`
                                      }`}
                                    >
                                      {action.value === 'close' && (
                                        <svg
                                          className="h-3.5 w-3.5"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <title>Close</title>
                                          <path d="M9 11l3 3L22 4" />
                                          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                        </svg>
                                      )}
                                      {action.value === 'in_progress' && (
                                        <svg
                                          className="h-3.5 w-3.5"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <title>In Progress</title>
                                          <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                      )}
                                      {action.value === 'reference' && (
                                        <svg
                                          className="h-3.5 w-3.5"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <title>Reference</title>
                                          <circle cx="12" cy="12" r="4" />
                                          <circle cx="12" cy="12" r="10" />
                                        </svg>
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="bg-zinc-950 border-zinc-700 px-3 py-2"
                                  >
                                    <p className={`font-medium text-sm ${action.accent}`}>
                                      {action.label}
                                    </p>
                                    <p className="text-zinc-400 text-xs mt-0.5">
                                      {action.description}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => removePattern(pattern.id)}
                            disabled={isPending}
                            className="p-1.5 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-100"
                            aria-label="Remove pattern"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <button
                type="button"
                onClick={addPattern}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/20 hover:bg-zinc-800/40 border border-dashed border-zinc-800 hover:border-zinc-700 transition-all duration-150"
              >
                <Plus className="h-3.5 w-3.5" />
                Add pattern
              </button>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Textarea
              id="agent-guidance"
              value={formData.agentGuidance}
              onChange={(e) => setFormData((prev) => ({ ...prev, agentGuidance: e.target.value }))}
              placeholder={`Example:

## Coding Conventions
- Use TypeScript strict mode
- Follow React 19 patterns

## Testing
- Run tests before committing
- Coverage must stay above 80%`}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm min-h-[200px] resize-y"
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
        <Button
          onClick={handleSave}
          disabled={!hasChanges || !isValid || isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {isPending ? (
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
    </div>
  )
}

/**
 * Inline input for adding keywords to a pattern.
 */
function KeywordInput({
  patternId,
  onAdd,
  existingKeywords,
}: {
  patternId: string
  onAdd: (id: string, keyword: string) => void
  existingKeywords: string[]
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    const trimmed = value.trim().toLowerCase().replace(/,+$/, '').trim()
    if (trimmed && !existingKeywords.some((k) => k.toLowerCase() === trimmed)) {
      onAdd(patternId, trimmed)
    }
    setValue('')
  }

  return (
    <input
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v.endsWith(',')) {
          const keyword = v.slice(0, -1).trim().toLowerCase()
          if (keyword && !existingKeywords.some((k) => k.toLowerCase() === keyword)) {
            onAdd(patternId, keyword)
          }
          setValue('')
          return
        }
        setValue(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
      onBlur={submit}
      placeholder={existingKeywords.length === 0 ? 'e.g., fixes' : 'add keyword...'}
      className="w-20 min-w-[80px] flex-shrink bg-transparent border-none outline-none text-zinc-300 placeholder:text-zinc-600 font-mono text-xs py-0.5 focus:ring-0"
    />
  )
}
