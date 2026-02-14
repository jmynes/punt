'use client'

import { GitBranch, Loader2, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/queries/use-system-settings'
import type { RepoHostingProvider } from '@/lib/system-settings'

const HOSTING_PROVIDERS: { value: RepoHostingProvider; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
  { value: 'gitea', label: 'Gitea' },
  { value: 'codeberg', label: 'Codeberg' },
  { value: 'other', label: 'Other' },
]

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

  // Local form state
  const [canonicalRepoUrl, setCanonicalRepoUrl] = useState('')
  const [repoHostingProvider, setRepoHostingProvider] = useState<RepoHostingProvider | ''>('')
  const [forkRepoUrl, setForkRepoUrl] = useState('')

  // Validation state
  const [canonicalUrlError, setCanonicalUrlError] = useState<string | null>(null)
  const [forkUrlError, setForkUrlError] = useState<string | null>(null)

  // Sync form state when settings are loaded
  useEffect(() => {
    if (settings) {
      setCanonicalRepoUrl(settings.canonicalRepoUrl ?? '')
      setRepoHostingProvider(settings.repoHostingProvider ?? '')
      setForkRepoUrl(settings.forkRepoUrl ?? '')
    }
  }, [settings])

  // Validate URLs on change
  useEffect(() => {
    if (canonicalRepoUrl && !isValidUrl(canonicalRepoUrl)) {
      setCanonicalUrlError('Please enter a valid URL (http:// or https://)')
    } else {
      setCanonicalUrlError(null)
    }
  }, [canonicalRepoUrl])

  useEffect(() => {
    if (forkRepoUrl && !isValidUrl(forkRepoUrl)) {
      setForkUrlError('Please enter a valid URL (http:// or https://)')
    } else {
      setForkUrlError(null)
    }
  }, [forkRepoUrl])

  const hasChanges =
    settings &&
    (canonicalRepoUrl !== (settings.canonicalRepoUrl ?? '') ||
      repoHostingProvider !== (settings.repoHostingProvider ?? '') ||
      forkRepoUrl !== (settings.forkRepoUrl ?? ''))

  const hasErrors = canonicalUrlError !== null || forkUrlError !== null

  const handleSave = () => {
    if (hasErrors) return

    updateSettings.mutate({
      canonicalRepoUrl: canonicalRepoUrl || null,
      repoHostingProvider: (repoHostingProvider as RepoHostingProvider) || null,
      forkRepoUrl: forkRepoUrl || null,
    })
  }

  const handleReset = () => {
    if (settings) {
      setCanonicalRepoUrl(settings.canonicalRepoUrl ?? '')
      setRepoHostingProvider(settings.repoHostingProvider ?? '')
      setForkRepoUrl(settings.forkRepoUrl ?? '')
      setCanonicalUrlError(null)
      setForkUrlError(null)
    }
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
      {/* Canonical Repository */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">Upstream Repository</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Configure the canonical (upstream) repository URL. This is where updates come from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hosting Provider */}
          <div className="space-y-2">
            <Label htmlFor="hostingProvider" className="text-zinc-300">
              Hosting Provider
            </Label>
            <Select
              value={repoHostingProvider}
              onValueChange={(value) => setRepoHostingProvider(value as RepoHostingProvider)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {HOSTING_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              The hosting platform where the upstream repository is hosted.
            </p>
          </div>

          {/* Canonical URL */}
          <div className="space-y-2">
            <Label htmlFor="canonicalRepoUrl" className="text-zinc-300">
              Canonical Repository URL
            </Label>
            <Input
              id="canonicalRepoUrl"
              type="url"
              value={canonicalRepoUrl}
              onChange={(e) => setCanonicalRepoUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-lg"
              placeholder="https://github.com/owner/repo"
            />
            {canonicalUrlError ? (
              <p className="text-xs text-red-400">{canonicalUrlError}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                The upstream repository URL that this installation should sync from for updates.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fork Configuration */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Fork Repository</CardTitle>
          <CardDescription className="text-zinc-400">
            If this is a fork, configure the fork URL separately from the upstream.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forkRepoUrl" className="text-zinc-300">
              Fork Repository URL
            </Label>
            <Input
              id="forkRepoUrl"
              type="url"
              value={forkRepoUrl}
              onChange={(e) => setForkRepoUrl(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-lg"
              placeholder="https://github.com/your-org/punt-fork"
            />
            {forkUrlError ? (
              <p className="text-xs text-red-400">{forkUrlError}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                Optional. If you are running a fork, enter the URL here. This can be used for
                linking back to your forked repository.
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
          disabled={!hasChanges || hasErrors || updateSettings.isPending}
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
