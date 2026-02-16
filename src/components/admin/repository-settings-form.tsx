'use client'

import {
  AlertCircle,
  Check,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitFork,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCheckForUpdates, useLocalVersion } from '@/hooks/queries/use-version'
import { useCtrlSave } from '@/hooks/use-ctrl-save'

const DEFAULT_REPO_URL = 'https://github.com/jmynes/punt/'

// Simple URL validation - allows http and https URLs
function isValidUrl(url: string): boolean {
  if (!url) return true // Empty is valid (optional field)
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown'
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown'
  }
}

interface CommitStatusProps {
  status: {
    aheadBy: number
    behindBy: number
    status: 'ahead' | 'behind' | 'identical' | 'diverged' | 'unknown'
  }
}

function CommitStatusInline({ status }: CommitStatusProps) {
  let message = ''
  let colorClass = 'text-zinc-400'

  if (status.status === 'ahead') {
    const s = status.aheadBy === 1 ? '' : 's'
    message = `${status.aheadBy} local change${s}`
    colorClass = 'text-blue-400'
  } else if (status.status === 'behind') {
    const s = status.behindBy === 1 ? '' : 's'
    message = `${status.behindBy} new commit${s} upstream`
    colorClass = 'text-amber-400'
  } else if (status.status === 'diverged') {
    message = `${status.aheadBy} local, ${status.behindBy} upstream`
    colorClass = 'text-amber-400'
  } else if (status.status === 'unknown') {
    message = 'custom build'
    colorClass = 'text-zinc-500'
  }

  if (!message) return null

  return <span className={colorClass}>{message}</span>
}

interface ForkComparisonProps {
  forkVsLocal: CommitStatusProps['status'] | null
  forkVsUpstream: CommitStatusProps['status'] | null
}

function ForkComparisonDisplay({ forkVsLocal, forkVsUpstream }: ForkComparisonProps) {
  return (
    <div className="space-y-1">
      {forkVsLocal && (
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs w-24">vs Local:</span>
          {forkVsLocal.status === 'identical' ? (
            <span className="text-green-400 text-xs">In sync</span>
          ) : forkVsLocal.status === 'ahead' ? (
            <span className="text-amber-400 text-xs">
              Fork is {forkVsLocal.aheadBy} commit{forkVsLocal.aheadBy === 1 ? '' : 's'} ahead
            </span>
          ) : forkVsLocal.status === 'behind' ? (
            <span className="text-blue-400 text-xs">
              Local is {forkVsLocal.behindBy} commit{forkVsLocal.behindBy === 1 ? '' : 's'} ahead
            </span>
          ) : forkVsLocal.status === 'diverged' ? (
            <span className="text-amber-400 text-xs">
              Diverged (+{forkVsLocal.aheadBy}/-{forkVsLocal.behindBy})
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">Unknown</span>
          )}
        </div>
      )}
      {forkVsUpstream && (
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs w-24">vs Upstream:</span>
          {forkVsUpstream.status === 'identical' ? (
            <span className="text-green-400 text-xs">In sync with upstream</span>
          ) : forkVsUpstream.status === 'ahead' ? (
            <span className="text-blue-400 text-xs">
              {forkVsUpstream.aheadBy} commit{forkVsUpstream.aheadBy === 1 ? '' : 's'} ahead
            </span>
          ) : forkVsUpstream.status === 'behind' ? (
            <span className="text-amber-400 text-xs">
              {forkVsUpstream.behindBy} commit{forkVsUpstream.behindBy === 1 ? '' : 's'} behind
            </span>
          ) : forkVsUpstream.status === 'diverged' ? (
            <span className="text-amber-400 text-xs">
              Diverged (+{forkVsUpstream.aheadBy}/-{forkVsUpstream.behindBy})
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">Unknown</span>
          )}
        </div>
      )}
    </div>
  )
}

export function RepositorySettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const { data: localVersion } = useLocalVersion()
  const updateSettings = useUpdateSystemSettings()
  const checkForUpdates = useCheckForUpdates()

  // Local form state - default to the canonical Punt repo
  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO_URL)
  const [forkUrl, setForkUrl] = useState('')
  const [checkForkForUpdates, setCheckForkForUpdates] = useState(false)

  // Validation state
  const [urlError, setUrlError] = useState<string | null>(null)
  const [forkUrlError, setForkUrlError] = useState<string | null>(null)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      // Use saved value if exists, otherwise use default
      setRepoUrl(settings.canonicalRepoUrl ?? DEFAULT_REPO_URL)
      setForkUrl(settings.forkRepoUrl ?? '')
      // If fork URL is set, assume user wants to check against it
      setCheckForkForUpdates(!!settings.forkRepoUrl)
    }
  }, [settings])

  // Validate URLs on change
  useEffect(() => {
    if (repoUrl && !isValidUrl(repoUrl)) {
      setUrlError('Please enter a valid URL (http:// or https://)')
    } else {
      setUrlError(null)
    }
  }, [repoUrl])

  useEffect(() => {
    if (forkUrl && !isValidUrl(forkUrl)) {
      setForkUrlError('Please enter a valid URL (http:// or https://)')
    } else {
      setForkUrlError(null)
    }
  }, [forkUrl])

  // Compare against saved values
  const savedUrl = settings?.canonicalRepoUrl ?? DEFAULT_REPO_URL
  const savedForkUrl = settings?.forkRepoUrl ?? ''
  const hasChanges = settings && (repoUrl !== savedUrl || forkUrl !== savedForkUrl)

  const handleSave = () => {
    if (urlError || forkUrlError) return

    updateSettings.mutate({
      canonicalRepoUrl: repoUrl || null,
      forkRepoUrl: forkUrl || null,
      // Auto-detect GitHub from canonical URL
      repoHostingProvider: repoUrl?.includes('github.com') ? 'github' : null,
    })
  }

  const handleReset = () => {
    setRepoUrl(savedUrl)
    setForkUrl(savedForkUrl)
    setCheckForkForUpdates(!!savedForkUrl)
    setUrlError(null)
    setForkUrlError(null)
  }

  const handleCheckForUpdates = () => {
    checkForUpdates.mutate()
  }

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useCtrlSave({
    onSave: handleSave,
    enabled: hasChanges && !urlError && !forkUrlError && !updateSettings.isPending,
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

  const updateResult = checkForUpdates.data

  return (
    <div className="space-y-6">
      {/* Current Version */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitCommit className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Installed Version</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Current version of Punt running on this server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Version</p>
              <p className="text-sm font-mono text-zinc-100">
                v{localVersion?.version || 'unknown'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Commit</p>
              <p className="text-sm font-mono text-zinc-100">
                {localVersion?.commitShort || 'unknown'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 mb-1">Built</p>
              <p className="text-sm text-zinc-100">{formatDate(localVersion?.buildTime ?? null)}</p>
            </div>
          </div>

          {/* Update Check Section - fixed height to prevent reflow */}
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-start justify-between gap-4 min-h-[2.5rem]">
            <div className="flex items-center gap-2 text-sm h-full flex-wrap">
              {checkForUpdates.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  <span className="text-zinc-400">Checking for updates...</span>
                </>
              ) : updateResult?.error ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-red-400">{updateResult.error}</span>
                </>
              ) : updateResult?.updateAvailable ? (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-400">
                    Update available:{' '}
                    <span className="font-mono">{updateResult.remote.latestVersion}</span>
                  </span>
                  {updateResult.remote.releaseUrl && (
                    <a
                      href={updateResult.remote.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : updateResult ? (
                <>
                  <Check className="h-4 w-4 text-green-400" />
                  <span className="text-green-400">Latest release</span>
                  {updateResult.commitStatus &&
                    updateResult.commitStatus.status !== 'identical' && (
                      <>
                        <span className="text-zinc-600">·</span>
                        <CommitStatusInline status={updateResult.commitStatus} />
                      </>
                    )}
                </>
              ) : (
                <span className="text-zinc-500">Click to check for updates</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={checkForUpdates.isPending}
              className="text-zinc-300 flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upstream Repository Configuration */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Upstream Repository</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            The canonical Punt repository. Used for checking for official releases and updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repoUrl" className="text-zinc-300">
              Upstream URL
            </Label>
            <Input
              id="repoUrl"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-lg"
              placeholder={DEFAULT_REPO_URL}
            />
            {urlError ? (
              <p className="text-xs text-red-400">{urlError}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                The official Punt repository for release updates and source code links.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fork Configuration */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitFork className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Fork Repository</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            If you&apos;re running a fork, configure it here to track your fork&apos;s updates
            separately from the upstream repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="checkFork" className="text-zinc-300">
                Track fork separately
              </Label>
              <p className="text-xs text-zinc-500">
                Enable to compare your local version against your fork repository
              </p>
            </div>
            <Switch
              id="checkFork"
              checked={checkForkForUpdates}
              onCheckedChange={(checked) => {
                setCheckForkForUpdates(checked)
                if (!checked) {
                  setForkUrl('')
                }
              }}
            />
          </div>

          {checkForkForUpdates && (
            <div className="space-y-2">
              <Label htmlFor="forkUrl" className="text-zinc-300">
                Fork URL
              </Label>
              <Input
                id="forkUrl"
                type="url"
                value={forkUrl}
                onChange={(e) => setForkUrl(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-lg"
                placeholder="https://github.com/your-username/punt/"
              />
              {forkUrlError ? (
                <p className="text-xs text-red-400">{forkUrlError}</p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Your forked repository URL. Update checks will show how your fork compares to both
                  your local version and the upstream repository.
                </p>
              )}
            </div>
          )}

          {checkForkForUpdates && forkUrl && updateResult?.forkStatus && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Fork Status</p>
              <div className="flex items-center gap-2 text-sm">
                {updateResult.forkStatus.error ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-red-400">{updateResult.forkStatus.error}</span>
                  </>
                ) : (
                  <ForkComparisonDisplay
                    forkVsLocal={updateResult.forkStatus.forkVsLocal ?? null}
                    forkVsUpstream={updateResult.forkStatus.forkVsUpstream ?? null}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          disabled={!hasChanges || updateSettings.isPending}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>

        <Button
          onClick={handleSave}
          disabled={
            !hasChanges || urlError !== null || forkUrlError !== null || updateSettings.isPending
          }
          variant="primary"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
