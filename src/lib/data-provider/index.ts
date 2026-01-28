/**
 * Data Provider Module
 *
 * Provides a unified interface for data operations that works in both
 * production (API) and demo (localStorage) modes.
 *
 * Usage:
 * ```typescript
 * import { getDataProvider } from '@/lib/data-provider'
 *
 * const provider = getDataProvider()
 * const projects = await provider.getProjects()
 * ```
 */

import { isDemoMode } from '../demo/demo-config'
import { APIDataProvider } from './api-provider'
import { DemoDataProvider } from './demo-provider'
import type { DataProvider } from './types'

// Singleton instances
let apiProvider: APIDataProvider | null = null
let demoProvider: DemoDataProvider | null = null

/**
 * Get the appropriate data provider based on the current mode.
 *
 * @param tabId - Optional tab ID for API provider (used for SSE deduplication)
 * @returns DataProvider instance
 */
export function getDataProvider(tabId?: string): DataProvider {
  if (isDemoMode()) {
    if (!demoProvider) {
      demoProvider = new DemoDataProvider()
    }
    return demoProvider
  }

  // For API provider, create new instance if tabId changes or doesn't exist
  if (!apiProvider || (tabId && tabId !== apiProvider.tabId)) {
    apiProvider = new APIDataProvider(tabId)
  }
  return apiProvider
}

/**
 * Create a new data provider instance (non-singleton).
 * Useful for testing or when you need isolated instances.
 *
 * @param tabId - Optional tab ID for API provider
 * @returns New DataProvider instance
 */
export function createDataProvider(tabId?: string): DataProvider {
  if (isDemoMode()) {
    return new DemoDataProvider()
  }
  return new APIDataProvider(tabId)
}

/**
 * React hook for getting the data provider.
 * Ensures the provider is stable across re-renders.
 */
export function useDataProvider(): DataProvider {
  // In a React context, we'd use useMemo, but this works for now
  // since getDataProvider returns singletons
  return getDataProvider()
}

// Export provider classes for advanced use cases
export { APIDataProvider } from './api-provider'
export { DemoDataProvider } from './demo-provider'
// Re-export types
export type {
  BrandingSettings,
  CompleteSprintInput,
  CreateLabelInput,
  CreateProjectInput,
  CreateSprintInput,
  CreateTicketInput,
  DashboardStats,
  DataProvider,
  ExtendSprintInput,
  MemberSummary,
  MoveTicketInput,
  ProjectSummary,
  ProjectWithDetails,
  RoleSummary,
  SprintSettings,
  StartSprintInput,
  UpdateLabelInput,
  UpdateProjectInput,
  UpdateSprintInput,
  UpdateTicketInput,
  UserSummary,
} from './types'
