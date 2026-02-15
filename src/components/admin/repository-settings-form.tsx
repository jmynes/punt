'use client'

import {
  AlertCircle,
  Check,
  ExternalLink,
  GitBranch,
  GitCommit,
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
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import { useCheckForUpdates, useLocalVersion } from '@/hooks/queries/use-version'

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
    message = `${status.aheadBy} ahead`
    colorClass = 'text-blue-400'
  } else if (status.status === 'behind') {
    message = `${status.behindBy} behind`
    colorClass = 'text-amber-400'
  } else if (status.status === 'diverged') {
    message = `${status.aheadBy}↑ ${status.behindBy}↓`
    colorClass = 'text-amber-400'
  } else if (status.status === 'unknown') {
    message = 'unrecognized commit'
    colorClass = 'text-zinc-500'
  }

  if (!message) return null

  return <span className={colorClass}>{message}</span>
}

export function RepositorySettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const { data: localVersion } = useLocalVersion()
  const updateSettings = useUpdateSystemSettings()
  const checkForUpdates = useCheckForUpdates()

  // Local form state - default to the canonical Punt repo
  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO_URL)

  // Validation state
  const [urlError, setUrlError] = useState<string | null>(null)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      // Use saved value if exists, otherwise use default
      setRepoUrl(settings.canonicalRepoUrl ?? DEFAULT_REPO_URL)
    }
  }, [settings])

  // Validate URL on change
  useEffect(() => {
    if (repoUrl && !isValidUrl(repoUrl)) {
      setUrlError('Please enter a valid URL (http:// or https://)')
    } else {
      setUrlError(null)
    }
  }, [repoUrl])

  // Compare against saved value (or default if never saved)
  const savedUrl = settings?.canonicalRepoUrl ?? DEFAULT_REPO_URL
  const hasChanges = settings && repoUrl !== savedUrl

  const handleSave = () => {
    if (urlError) return

    updateSettings.mutate({
      canonicalRepoUrl: repoUrl || null,
      // Auto-detect GitHub
      repoHostingProvider: repoUrl?.includes('github.com') ? 'github' : null,
    })
  }

  const handleReset = () => {
    setRepoUrl(savedUrl)
    setUrlError(null)
  }

  const handleCheckForUpdates = () => {
    checkForUpdates.mutate()
  }

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
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-start justify-between gap-4 h-[2.5rem]">
            <div className="flex items-center gap-2 text-sm h-full">
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

      {/* Repository Configuration */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Punt Repository</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            The source repository for Punt. Change this if you&apos;re running a fork.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repoUrl" className="text-zinc-300">
              Repository URL
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
                The repository URL used for linking to source code and checking for updates.
              </p>
            )}
          </div>
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
          disabled={!hasChanges || urlError !== null || updateSettings.isPending}
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
