'use client'

import { Loader2, TrendingDown } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { BurndownChart } from '@/components/burndown/burndown-chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBurndownData } from '@/hooks/queries/use-burndown'
import { useActiveSprint, useProjectSprints } from '@/hooks/queries/use-sprints'
import { useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'
import type { BurndownUnit } from '@/lib/data-provider/types'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

export default function ChartsPage() {
  const params = useParams()
  const router = useRouter()
  const projectKey = params.projectId as string
  const { getProjectByKey, isLoading: projectsLoading } = useProjectsStore()
  const project = getProjectByKey(projectKey)
  const projectId = project?.id || projectKey
  const { setActiveProjectId } = useUIStore()

  // Tab cycling keyboard shortcut (Ctrl+Shift+Arrow)
  useTabCycleShortcut({
    tabs: [
      `/projects/${projectKey}/board`,
      `/projects/${projectKey}/backlog`,
      `/projects/${projectKey}/sprints`,
      `/projects/${projectKey}/burndown`,
    ],
  })

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [unit, setUnit] = useState<BurndownUnit>('points')

  // Fetch sprints
  const { data: sprints, isLoading: sprintsLoading } = useProjectSprints(projectId)
  const { data: activeSprint } = useActiveSprint(projectId)

  // Filter to non-planning sprints (active + completed)
  const eligibleSprints = useMemo(
    () => (sprints ?? []).filter((s) => s.status !== 'planning'),
    [sprints],
  )

  // Default to active sprint when it loads
  useEffect(() => {
    if (selectedSprintId) return
    if (activeSprint) {
      setSelectedSprintId(activeSprint.id)
    } else if (eligibleSprints.length > 0) {
      setSelectedSprintId(eligibleSprints[0].id)
    }
  }, [activeSprint, eligibleSprints, selectedSprintId])

  // Fetch burndown data
  const { data: burndownData, isLoading: burndownLoading } = useBurndownData(
    projectId,
    selectedSprintId,
    unit,
  )

  // Set active project
  useEffect(() => {
    if (projectId) setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId])

  // Redirect if project doesn't exist
  useEffect(() => {
    if (!projectsLoading && !project) {
      router.replace('/')
    }
  }, [projectsLoading, project, router])

  if (!projectsLoading && !project) return null

  const unitLabel = unit === 'points' ? 'pts' : 'tickets'

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
              <TrendingDown className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {project?.key ?? projectKey} Charts
              </h1>
              <p className="text-sm text-zinc-500">Sprint burndown and progress tracking</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unit toggle */}
            <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  unit === 'points'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200',
                )}
                onClick={() => setUnit('points')}
              >
                Points
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  unit === 'tickets'
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200',
                )}
                onClick={() => setUnit('tickets')}
              >
                Tickets
              </button>
            </div>

            {/* Sprint selector */}
            {eligibleSprints.length > 0 && (
              <Select
                value={selectedSprintId ?? ''}
                onValueChange={(value) => setSelectedSprintId(value)}
              >
                <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-zinc-100">
                  <SelectValue placeholder="Select sprint" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {eligibleSprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id} className="text-zinc-100">
                      {sprint.name}
                      {sprint.status === 'active' ? ' (Active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 lg:p-6">
          {sprintsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-3 text-sm text-zinc-500">Loading sprints...</p>
            </div>
          ) : eligibleSprints.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50">
              <TrendingDown className="h-12 w-12 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400">No active or completed sprints</p>
              <p className="text-xs text-zinc-600 mt-1">Start a sprint to see burndown data</p>
            </div>
          ) : burndownLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-3 text-sm text-zinc-500">Loading burndown data...</p>
            </div>
          ) : burndownData ? (
            <div className="space-y-4">
              {/* Sprint info summary */}
              {burndownData.sprint.startDate && (
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>Start: {new Date(burndownData.sprint.startDate).toLocaleDateString()}</span>
                  {burndownData.sprint.endDate && (
                    <span>End: {new Date(burndownData.sprint.endDate).toLocaleDateString()}</span>
                  )}
                  {burndownData.dataPoints.length > 0 && (
                    <span>
                      Scope: {burndownData.dataPoints[burndownData.dataPoints.length - 1].scope}{' '}
                      {unitLabel}
                    </span>
                  )}
                </div>
              )}

              {/* Chart */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <BurndownChart dataPoints={burndownData.dataPoints} />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 rounded bg-red-500" />
                  <span>Remaining</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 border-t-2 border-dashed border-zinc-600" />
                  <span>Guideline</span>
                </div>
                {new Set(burndownData.dataPoints.map((d) => d.scope)).size > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6 rounded bg-amber-500" />
                    <span>Scope</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
