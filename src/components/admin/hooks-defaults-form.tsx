'use client'

import { ArrowRight, GitCommitHorizontal, Info, Loader2, Plus, Save, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCtrlSave } from '@/hooks/use-ctrl-save'

type CommitPatternAction = 'close' | 'in_progress' | 'reference'

interface CommitPattern {
  id: string
  pattern: string
  action: CommitPatternAction
  isRegex?: boolean
  enabled?: boolean
  keywords?: string[]
}

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

export function HooksDefaultsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

  const [commitPatterns, setCommitPatterns] = useState<CommitPattern[]>([])

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setCommitPatterns(
        Array.isArray(settings.defaultCommitPatterns)
          ? (settings.defaultCommitPatterns as CommitPattern[])
          : [],
      )
    }
  }, [settings])

  // Check for changes
  const hasChanges =
    settings &&
    JSON.stringify(commitPatterns) !==
      JSON.stringify(
        Array.isArray(settings.defaultCommitPatterns) ? settings.defaultCommitPatterns : [],
      )

  const handleSave = useCallback(() => {
    updateSettings.mutate({
      defaultCommitPatterns: commitPatterns.length > 0 ? commitPatterns : null,
    })
  }, [commitPatterns, updateSettings])

  const handleReset = useCallback(() => {
    if (settings) {
      setCommitPatterns(
        Array.isArray(settings.defaultCommitPatterns)
          ? (settings.defaultCommitPatterns as CommitPattern[])
          : [],
      )
    }
  }, [settings])

  // Commit pattern handlers
  const addPattern = useCallback(() => {
    const newPattern: CommitPattern = {
      id: crypto.randomUUID(),
      pattern: '',
      action: 'reference',
      enabled: true,
    }
    setCommitPatterns((prev) => [...prev, newPattern])
  }, [])

  const updatePattern = useCallback(
    (id: string, field: keyof CommitPattern, value: string | boolean | string[]) => {
      setCommitPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
    },
    [],
  )

  const removePattern = useCallback((id: string) => {
    setCommitPatterns((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addKeyword = useCallback((id: string, keyword: string) => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return
    setCommitPatterns((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        if (!p.pattern) {
          return { ...p, pattern: trimmed }
        }
        if (p.pattern.toLowerCase() === trimmed) return p
        if (p.keywords?.some((k) => k.toLowerCase() === trimmed)) return p
        return { ...p, keywords: [...(p.keywords ?? []), trimmed] }
      }),
    )
  }, [])

  const removeKeyword = useCallback((id: string, index: number) => {
    setCommitPatterns(
      (prev) =>
        prev
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
    )
  }, [])

  const loadDefaultPatterns = useCallback(() => {
    setCommitPatterns(DEFAULT_COMMIT_PATTERNS.map((p) => ({ ...p, id: crypto.randomUUID() })))
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
            {commitPatterns.length === 0 && (
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
          {commitPatterns.length === 0 ? (
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
                  {commitPatterns.map((pattern) => {
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
          disabled={!hasChanges || isPending}
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
