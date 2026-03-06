/**
 * Story point scale configuration.
 *
 * Provides the two supported point scales and utilities for resolving
 * the active scale for a given project (project override > global default).
 */

export type StoryPointScale = 'sequential' | 'fibonacci'

export const STORY_POINT_SCALES: Record<StoryPointScale, number[]> = {
  sequential: [1, 2, 3, 4, 5],
  fibonacci: [1, 2, 3, 5, 8, 13],
}

export const STORY_POINT_SCALE_LABELS: Record<StoryPointScale, string> = {
  sequential: 'Sequential (1-5)',
  fibonacci: 'Fibonacci (1, 2, 3, 5, 8, 13)',
}

/** Default scale when nothing is configured. */
export const DEFAULT_STORY_POINT_SCALE: StoryPointScale = 'sequential'

/**
 * Validate that a string is a valid story point scale.
 */
export function isValidStoryPointScale(value: unknown): value is StoryPointScale {
  return value === 'sequential' || value === 'fibonacci'
}

/**
 * Get the point values for a given scale name.
 * Falls back to sequential if the scale name is invalid.
 */
export function getStoryPointValues(scale: string | null | undefined): number[] {
  if (scale && isValidStoryPointScale(scale)) {
    return STORY_POINT_SCALES[scale]
  }
  return STORY_POINT_SCALES[DEFAULT_STORY_POINT_SCALE]
}

/**
 * Resolve the effective story point scale for a project.
 *
 * @param projectScale - The per-project override (null means "use global default")
 * @param globalScale  - The global system setting
 * @returns The resolved scale name
 */
export function resolveStoryPointScale(
  projectScale: string | null | undefined,
  globalScale: string | null | undefined,
): StoryPointScale {
  if (projectScale && isValidStoryPointScale(projectScale)) {
    return projectScale
  }
  if (globalScale && isValidStoryPointScale(globalScale)) {
    return globalScale
  }
  return DEFAULT_STORY_POINT_SCALE
}
