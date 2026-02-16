'use client'

import { ExternalLink, GitBranch, Info, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRepositoryConfig, useUpdateRepository } from '@/hooks/queries/use-repository'
import { useHasPermission } from '@/hooks/use-permissions'
import { previewBranchName, validateBranchTemplate } from '@/lib/branch-utils'
import { PERMISSIONS } from '@/lib/permissions'
import { REPO_PROVIDERS, type RepoProvider } from '@/types'

const PROVIDER_LABELS: Record<RepoProvider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  gitea: 'Gitea',
  codeberg: 'Codeberg',
  other: 'Other',
}

interface RepositoryTabProps {
  projectId: string
  projectKey: string
}

interface FormData {
  repositoryUrl: string
  repositoryProvider: RepoProvider | ''
  localPath: string
  defaultBranch: string
  branchTemplate: string
  monorepoPath: string
}

export function RepositoryTab({ projectId, projectKey }: RepositoryTabProps) {
  const { data: config, isLoading } = useRepositoryConfig(projectKey)
  const updateRepository = useUpdateRepository(projectKey)

  const canEditSettings = useHasPermission(projectId, PERMISSIONS.PROJECT_SETTINGS)

  const [formData, setFormData] = useState<FormData>({
    repositoryUrl: '',
    repositoryProvider: '',
    localPath: '',
    defaultBranch: '',
    branchTemplate: '',
    monorepoPath: '',
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [branchTemplateError, setBranchTemplateError] = useState<string | null>(null)

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        repositoryUrl: config.repositoryUrl || '',
        repositoryProvider: (config.repositoryProvider as RepoProvider) || '',
        localPath: config.localPath || '',
        defaultBranch: config.defaultBranch || '',
        branchTemplate: config.branchTemplate || '',
        monorepoPath: config.monorepoPath || '',
      })
      setHasChanges(false)
    }
  }, [config])

  // Track changes
  useEffect(() => {
    if (!config) return

    const changed =
      formData.repositoryUrl !== (config.repositoryUrl || '') ||
      formData.repositoryProvider !== (config.repositoryProvider || '') ||
      formData.localPath !== (config.localPath || '') ||
      formData.defaultBranch !== (config.defaultBranch || '') ||
      formData.branchTemplate !== (config.branchTemplate || '') ||
      formData.monorepoPath !== (config.monorepoPath || '')

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
      repositoryProvider: (formData.repositoryProvider as RepoProvider) || null,
      localPath: formData.localPath || null,
      defaultBranch: formData.defaultBranch || null,
      branchTemplate: formData.branchTemplate || null,
      monorepoPath: formData.monorepoPath || null,
    })
  }, [canEditSettings, formData, updateRepository])

  const handleReset = useCallback(() => {
    if (config) {
      setFormData({
        repositoryUrl: config.repositoryUrl || '',
        repositoryProvider: (config.repositoryProvider as RepoProvider) || '',
        localPath: config.localPath || '',
        defaultBranch: config.defaultBranch || '',
        branchTemplate: config.branchTemplate || '',
        monorepoPath: config.monorepoPath || '',
      })
    }
  }, [config])

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

            {/* Repository Provider */}
            <div className="space-y-2">
              <Label htmlFor="repository-provider" className="text-zinc-300">
                Hosting Provider
              </Label>
              <Select
                value={formData.repositoryProvider}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    repositoryProvider: value as RepoProvider,
                  }))
                }
                disabled={isDisabled}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {REPO_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <p className="text-xs text-zinc-500">
                Leave empty to use the system default. Variables: {'{key}'}, {'{number}'},{' '}
                {'{type}'}, {'{slug}'}, {'{project}'}
              </p>
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
