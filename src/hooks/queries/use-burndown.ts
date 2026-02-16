'use client'

import { useQuery } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { getDataProvider } from '@/lib/data-provider'
import type { BurndownData, BurndownUnit } from '@/lib/data-provider/types'

export const burndownKeys = {
  all: ['burndown'] as const,
  bySprint: (projectId: string, sprintId: string, unit: BurndownUnit) =>
    ['burndown', projectId, sprintId, unit] as const,
}

export function useBurndownData(
  projectId: string,
  sprintId: string | null,
  unit: BurndownUnit = 'points',
) {
  return useQuery<BurndownData>({
    queryKey: burndownKeys.bySprint(projectId, sprintId ?? '', unit),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getBurndownData(projectId, sprintId as string, unit)
    },
    enabled: !!projectId && !!sprintId,
    staleTime: 1000 * 60,
  })
}
