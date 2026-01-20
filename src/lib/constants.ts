/**
 * Shared constants used across the application.
 */

/**
 * Demo project IDs that use localStorage instead of API.
 * These projects work offline and don't persist to the database.
 */
export const DEMO_PROJECT_IDS = ['1', '2', '3'] as const

/**
 * Check if a project ID is a demo project.
 * Demo projects use localStorage for data persistence instead of API calls.
 */
export function isDemoProject(projectId: string): boolean {
  return DEMO_PROJECT_IDS.includes(projectId as (typeof DEMO_PROJECT_IDS)[number])
}
