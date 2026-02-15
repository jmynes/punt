'use client'

import { GitBranch, Loader2, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'

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

export function RepositorySettingsForm() {
  const { data: settings, isLoading, error } = useSystemSettings()
  const updateSettings = useUpdateSystemSettings()

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
