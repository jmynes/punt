'use client'

import {
  ArrowRight,
  Check,
  CircleDot,
  Copy,
  ExternalLink,
  GitCommitHorizontal,
  Key,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  SquareCheck,
  Trash2,
  Webhook,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type CommitPattern,
  type CommitPatternAction,
  useCommitPatterns,
  useRepositoryConfig,
  useWebhookSecret,
} from '@/hooks/queries/use-repository'
import { useCtrlSave } from '@/hooks/use-ctrl-save'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'

interface HooksTabProps {
  projectId: string
  projectKey: string
}

/**
 * Extract owner/repo from a GitHub URL
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
function getGitHubRepoPath(url: string): string | null {
  if (!url) return null
  const match = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/)
  return match ? match[1] : null
}

// Commit pattern action configuration
const PATTERN_ACTIONS: {
  value: CommitPatternAction
  label: string
  description: string
  icon: typeof SquareCheck
  accent: string
  accentMuted: string
}[] = [
  {
    value: 'close',
    label: 'Close',
    description: 'Move ticket to Done',
    icon: SquareCheck,
    accent: 'text-emerald-400',
    accentMuted: 'text-emerald-500/70',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    description: 'Move ticket to In Progress',
    icon: Play,
    accent: 'text-amber-400',
    accentMuted: 'text-amber-500/70',
  },
  {
    value: 'reference',
    label: 'Reference',
    description: 'Log commit reference only',
    icon: CircleDot,
    accent: 'text-sky-400',
    accentMuted: 'text-sky-500/70',
  },
]

// Default commit patterns
const DEFAULT_PATTERNS: CommitPattern[] = [
  { id: '1', pattern: 'fixes', action: 'close', enabled: true },
  { id: '2', pattern: 'closes', action: 'close', enabled: true },
  { id: '3', pattern: 'resolves', action: 'close', enabled: true },
  { id: '4', pattern: 'wip', action: 'in_progress', enabled: true },
]

function getActionConfig(action: CommitPatternAction) {
  return PATTERN_ACTIONS.find((a) => a.value === action) ?? PATTERN_ACTIONS[2]
}

export function HooksTab({ projectId, projectKey }: HooksTabProps) {
  const { data: config, isLoading } = useRepositoryConfig(projectKey)
  const webhookSecret = useWebhookSecret(projectKey)
  const commitPatternsMutation = useCommitPatterns(projectKey)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)

  // Webhook secret state
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null)
  const [showSecret] = useState(false)
  const [showRemoveSecretConfirm, setShowRemoveSecretConfirm] = useState(false)

  // Commit patterns state
  const [patterns, setPatterns] = useState<CommitPattern[]>([])
  const [patternsHaveChanges, setPatternsHaveChanges] = useState(false)

  // Initialize commit patterns when config loads
  // Use a ref to track if we have local changes to avoid overwriting them on config refetch
  const hasLocalChangesRef = useRef(false)

  useEffect(() => {
    if (config && !hasLocalChangesRef.current) {
      setPatterns(config.commitPatterns || [])
      setPatternsHaveChanges(false)
    }
  }, [config])

  // Keep ref in sync with state
  useEffect(() => {
    hasLocalChangesRef.current = patternsHaveChanges
  }, [patternsHaveChanges])

  // Commit pattern handlers
  const addPattern = useCallback(() => {
    const newPattern: CommitPattern = {
      id: crypto.randomUUID(),
      pattern: '',
      action: 'reference',
      enabled: true,
    }
    setPatterns((prev) => [...prev, newPattern])
    setPatternsHaveChanges(true)
  }, [])

  const updatePattern = useCallback(
    (id: string, field: keyof CommitPattern, value: string | boolean) => {
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
      setPatternsHaveChanges(true)
    },
    [],
  )

  const removePattern = useCallback((id: string) => {
    setPatterns((prev) => prev.filter((p) => p.id !== id))
    setPatternsHaveChanges(true)
  }, [])

  const resetPatternsToDefaults = useCallback(() => {
    setPatterns(DEFAULT_PATTERNS.map((p) => ({ ...p, id: crypto.randomUUID() })))
    setPatternsHaveChanges(true)
  }, [])

  const savePatterns = useCallback(async () => {
    await commitPatternsMutation.mutateAsync(patterns.length > 0 ? patterns : null)
    setPatternsHaveChanges(false)
  }, [commitPatternsMutation, patterns])

  const resetPatterns = useCallback(() => {
    setPatterns(config?.commitPatterns || [])
    setPatternsHaveChanges(false)
  }, [config?.commitPatterns])

  const isDisabled = !canEditSettings
  const hasWebhookSecret = config?.hasWebhookSecret || generatedSecret

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: savePatterns,
    enabled: patternsHaveChanges && !isDisabled,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const repositoryUrl = config?.repositoryUrl || ''

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-6 pb-4">
        <div>
          <h3 className="text-lg font-medium text-zinc-100">Hooks</h3>
          <p className="text-sm text-zinc-500">
            Configure webhooks and commit patterns to automate ticket updates.
          </p>
        </div>

        {/* GitHub Integration Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              GitHub Integration
            </CardTitle>
            <CardDescription>
              Automatically update tickets when commits are pushed to GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-sm select-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/github
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/api/webhooks/github`
                    navigator.clipboard.writeText(url)
                    setCopiedUrl(true)
                    setTimeout(() => setCopiedUrl(false), 2000)
                  }}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Add this URL as a webhook in your GitHub repository settings.
              </p>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Key className="h-3.5 w-3.5" />
                Webhook Secret
              </Label>
              {config?.hasWebhookSecret || generatedSecret ? (
                <div className="space-y-2">
                  {generatedSecret && (
                    <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-900/50">
                      <p className="text-xs text-emerald-300 mb-2">
                        Copy this secret now - it won&apos;t be shown again!
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          type={showSecret ? 'text' : 'password'}
                          value={generatedSecret}
                          className="bg-zinc-900 border-zinc-700 text-emerald-300 font-mono text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedSecret)
                            setCopiedSecret(true)
                            setTimeout(() => setCopiedSecret(false), 2000)
                          }}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          {copiedSecret ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!generatedSecret && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-zinc-800/50 border border-zinc-800">
                      <Key className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm text-zinc-300">Webhook secret is configured</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await webhookSecret.mutateAsync('generate')
                        if (result.webhookSecret) {
                          setGeneratedSecret(result.webhookSecret)
                          // Auto-load and save default patterns if none configured
                          setPatterns((currentPatterns) => {
                            if (currentPatterns.length === 0) {
                              const newPatterns = DEFAULT_PATTERNS.map((p) => ({
                                ...p,
                                id: crypto.randomUUID(),
                              }))
                              // Prevent config refetch from overwriting during async save
                              hasLocalChangesRef.current = true
                              // Auto-save the defaults along with the secret
                              commitPatternsMutation.mutate(newPatterns, {
                                onSettled: () => {
                                  hasLocalChangesRef.current = false
                                },
                              })
                              return newPatterns
                            }
                            return currentPatterns
                          })
                        }
                      }}
                      disabled={!canEditSettings || webhookSecret.isPending}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      {webhookSecret.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRemoveSecretConfirm(true)}
                      disabled={!canEditSettings || webhookSecret.isPending}
                      className="border-zinc-700 text-rose-400 hover:bg-rose-950/30 hover:border-rose-800"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-500">
                    No webhook secret configured. Generate one to secure your webhook.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const result = await webhookSecret.mutateAsync('generate')
                      if (result.webhookSecret) {
                        setGeneratedSecret(result.webhookSecret)
                        // Auto-load and save default patterns if none configured
                        setPatterns((currentPatterns) => {
                          if (currentPatterns.length === 0) {
                            const newPatterns = DEFAULT_PATTERNS.map((p) => ({
                              ...p,
                              id: crypto.randomUUID(),
                            }))
                            // Prevent config refetch from overwriting during async save
                            hasLocalChangesRef.current = true
                            // Auto-save the defaults along with the secret
                            commitPatternsMutation.mutate(newPatterns, {
                              onSettled: () => {
                                hasLocalChangesRef.current = false
                              },
                            })
                            return newPatterns
                          }
                          return currentPatterns
                        })
                      }
                    }}
                    disabled={!canEditSettings || webhookSecret.isPending}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    {webhookSecret.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Generate Secret
                  </Button>
                </div>
              )}
            </div>

            {/* Setup Instructions */}
            <div className="p-3 rounded-md bg-blue-950/30 border border-blue-900/50">
              <p className="text-xs font-medium text-blue-300 mb-2">Setup Instructions</p>
              <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
                <li>Copy the Webhook URL above</li>
                <li>Generate a webhook secret and copy it</li>
                <li>
                  In GitHub:{' '}
                  {getGitHubRepoPath(repositoryUrl) ? (
                    <a
                      href={`https://github.com/${getGitHubRepoPath(repositoryUrl)}/settings/hooks/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 underline underline-offset-2"
                    >
                      Add webhook
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    'Go to repo Settings → Webhooks → Add webhook'
                  )}
                </li>
                <li>Paste the Payload URL and Secret</li>
                <li>Set Content type to &quot;application/json&quot;</li>
                <li>Select &quot;Just the push event&quot;</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Commit Patterns Card */}
        <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                  <GitCommitHorizontal className="h-4 w-4" />
                  Commit Patterns
                </CardTitle>
                <CardDescription className="mt-1">
                  Define patterns to trigger ticket actions from commit messages.
                </CardDescription>
              </div>
              {patterns.length === 0 && !isDisabled && hasWebhookSecret && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetPatternsToDefaults}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Load Defaults
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {patterns.length === 0 ? (
              /* Empty state */
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent rounded-xl pointer-events-none" />
                <div className="relative flex flex-col items-center py-10 px-4">
                  {/* Visual showing the concept */}
                  <div
                    className={`flex items-center gap-2 mb-6 ${hasWebhookSecret ? 'opacity-50' : 'opacity-30'}`}
                  >
                    <div className="px-3 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/50 font-mono text-xs text-zinc-400">
                      fixes {projectKey}-42
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-600" />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/50 border border-emerald-800/30">
                      <SquareCheck className="h-3 w-3 text-emerald-400/70" />
                      <span className="text-xs text-emerald-300/70">Done</span>
                    </div>
                  </div>
                  {hasWebhookSecret ? (
                    <>
                      <p className="text-sm text-zinc-400 mb-1">No custom patterns configured</p>
                      <p className="text-xs text-zinc-600 text-center max-w-[300px]">
                        Using built-in defaults. Add custom patterns to control how commits update
                        tickets.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-500 mb-1">Webhook secret required</p>
                      <p className="text-xs text-zinc-600 text-center max-w-[300px]">
                        Generate a webhook secret above to configure commit patterns.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Pattern list */
              <div className="space-y-3">
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1.5 pr-2">
                    {patterns.map((pattern) => {
                      const actionConfig = getActionConfig(pattern.action)

                      return (
                        <div
                          key={pattern.id}
                          className={`group relative flex items-center gap-3 p-2.5 rounded-md border transition-all duration-150 ${
                            pattern.enabled !== false
                              ? 'bg-zinc-800/40 border-zinc-700/50 hover:border-zinc-600/50'
                              : 'bg-zinc-900/30 border-zinc-800/30 opacity-50'
                          }`}
                        >
                          {/* Action indicator */}
                          <div
                            className={`w-1 h-8 rounded-full ${actionConfig.accent.replace('text-', 'bg-')}`}
                          />

                          {/* Pattern input */}
                          <div className="flex-1 min-w-0">
                            <Input
                              value={pattern.pattern}
                              onChange={(e) => updatePattern(pattern.id, 'pattern', e.target.value)}
                              placeholder="e.g., fixes, closes, wip"
                              disabled={isDisabled}
                              className="h-8 bg-zinc-900/60 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm focus:border-zinc-500"
                            />
                          </div>

                          {/* Action selector */}
                          <div className="flex items-center gap-0.5 p-1 rounded-md bg-zinc-900/50">
                            {PATTERN_ACTIONS.map((action) => {
                              const Icon = action.icon
                              const isSelected = pattern.action === action.value
                              return (
                                <Tooltip key={action.value} delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePattern(pattern.id, 'action', action.value)
                                      }
                                      disabled={isDisabled}
                                      className={`p-1.5 rounded transition-all duration-100 disabled:opacity-50 ${
                                        isSelected
                                          ? `${action.accent} bg-zinc-800`
                                          : `${action.accentMuted} hover:${action.accent} hover:bg-zinc-800/50`
                                      }`}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
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

                          {/* Delete button */}
                          {!isDisabled && (
                            <button
                              type="button"
                              onClick={() => removePattern(pattern.id)}
                              className="p-1.5 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-100"
                              aria-label="Remove pattern"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Add pattern button */}
                {!isDisabled && hasWebhookSecret && (
                  <button
                    type="button"
                    onClick={addPattern}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/20 hover:bg-zinc-800/40 border border-dashed border-zinc-800 hover:border-zinc-700 transition-all duration-150"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add pattern
                  </button>
                )}

                {/* Preview section */}
                <div className="mt-4 p-3 rounded-md bg-zinc-950/50 border border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <GitCommitHorizontal className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-400">Preview</span>
                  </div>
                  <div className="space-y-1.5">
                    {patterns
                      .filter((p) => p.pattern && p.enabled !== false)
                      .slice(0, 3)
                      .map((p) => {
                        const cfg = getActionConfig(p.action)
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-zinc-500">
                              &quot;{p.pattern} {projectKey}-42&quot;
                            </span>
                            <ArrowRight className="h-3 w-3 text-zinc-600" />
                            <span className={cfg.accent}>{cfg.label}</span>
                          </div>
                        )
                      })}
                    {patterns.filter((p) => p.pattern && p.enabled !== false).length === 0 && (
                      <p className="text-xs text-zinc-600 italic">Add patterns to see preview</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supported Patterns Reference */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Built-in Patterns</CardTitle>
            <CardDescription>
              These patterns are always recognized, even without custom configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-zinc-800/50 border border-zinc-800">
                <span className="text-emerald-400 font-mono">fixes {projectKey}-123</span>
                <p className="text-zinc-500 mt-0.5">Moves ticket to Done</p>
              </div>
              <div className="p-2 rounded bg-zinc-800/50 border border-zinc-800">
                <span className="text-emerald-400 font-mono">closes {projectKey}-123</span>
                <p className="text-zinc-500 mt-0.5">Moves ticket to Done</p>
              </div>
              <div className="p-2 rounded bg-zinc-800/50 border border-zinc-800">
                <span className="text-amber-400 font-mono">wip {projectKey}-123</span>
                <p className="text-zinc-500 mt-0.5">Moves to In Progress</p>
              </div>
              <div className="p-2 rounded bg-zinc-800/50 border border-zinc-800">
                <span className="text-sky-400 font-mono">{projectKey}-123</span>
                <p className="text-zinc-500 mt-0.5">References ticket</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer with save/cancel */}
      {canEditSettings && patternsHaveChanges && (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
          <p className="text-sm text-zinc-400">You have unsaved changes</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetPatterns}
              disabled={commitPatternsMutation.isPending}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={savePatterns}
              disabled={commitPatternsMutation.isPending}
            >
              {commitPatternsMutation.isPending ? (
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

      {/* Remove webhook secret confirmation */}
      <AlertDialog open={showRemoveSecretConfirm} onOpenChange={setShowRemoveSecretConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Remove webhook secret?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will remove the webhook secret from this project. Your GitHub webhook will no
              longer be verified, which may expose your endpoint to unauthorized requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={async () => {
                await webhookSecret.mutateAsync('clear')
                setGeneratedSecret(null)
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Remove Secret
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
