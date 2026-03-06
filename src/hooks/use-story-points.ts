'use client'

import { useMemo } from 'react'
import { useSprintSettings } from '@/hooks/queries/use-sprints'
import { useSystemSettings } from '@/hooks/queries/use-system-settings'
import {
  DEFAULT_STORY_POINT_SCALE,
  getStoryPointValues,
  resolveStoryPointScale,
  type StoryPointScale,
} from '@/lib/story-points'

/**
 * Returns the active story point scale and values for a given project.
 *
 * Resolution order: project override > global default > 'sequential'
 */
export function useStoryPointScale(projectId: string) {
  const { data: sprintSettings } = useSprintSettings(projectId)
  const { data: systemSettings } = useSystemSettings()

  return useMemo(() => {
    const projectScale = sprintSettings?.storyPointScale ?? null
    const globalScale = systemSettings?.storyPointScale ?? null

    const effectiveScale = resolveStoryPointScale(projectScale, globalScale)
    const values = getStoryPointValues(effectiveScale)

    return {
      scale: effectiveScale,
      values,
      /** Whether the project has its own override (not using global default). */
      isProjectOverride: projectScale !== null,
      /** The global default scale. */
      globalScale: (globalScale ?? DEFAULT_STORY_POINT_SCALE) as StoryPointScale,
    }
  }, [sprintSettings?.storyPointScale, systemSettings?.storyPointScale])
}
