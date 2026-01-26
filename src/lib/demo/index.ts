/**
 * Demo mode module
 *
 * Provides client-side only storage for demo deployments.
 * When NEXT_PUBLIC_DEMO_MODE=true, the app runs entirely in the browser
 * with data persisted to localStorage.
 */

export { DEMO_STORAGE_PREFIX, DEMO_TEAM_MEMBERS, DEMO_USER, isDemoMode } from './demo-config'
export {
  DEMO_COLUMNS,
  DEMO_LABELS,
  DEMO_MEMBER,
  DEMO_PROJECTS,
  DEMO_ROLE,
  DEMO_SPRINTS,
  DEMO_TEAM_SUMMARIES,
  DEMO_TICKETS,
  DEMO_USER_SUMMARY,
  getColumnsWithTickets,
  getProjectLabels,
  getProjectSprints,
} from './demo-data'
export { demoStorage, type ProjectSummary } from './demo-storage'
