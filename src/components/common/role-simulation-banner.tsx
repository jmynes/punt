'use client'

import { Eye, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useProjectsStore } from '@/stores/projects-store'
import { useRoleSimulationStore } from '@/stores/role-simulation-store'

/**
 * Banner displayed when the user is simulating a different role.
 * Shows which role is being simulated and provides a way to exit.
 * Renders at the top of the app layout, above the header.
 */
export function RoleSimulationBanner() {
  const params = useParams()
  const projectKey = params?.projectId as string | undefined
  const { getProjectByKey } = useProjectsStore()

  // Resolve project ID from the URL key
  const project = projectKey ? getProjectByKey(projectKey) : null
  const projectId = project?.id ?? null

  const simulatedRoles = useRoleSimulationStore((s) => s.simulatedRoles)
  const stopSimulation = useRoleSimulationStore((s) => s.stopSimulation)

  // Find the active simulation for the current project
  const simulation = projectId ? (simulatedRoles[projectId] ?? null) : null

  const handleExit = useCallback(() => {
    if (projectId) {
      stopSimulation(projectId)
    }
  }, [projectId, stopSimulation])

  // Handle Escape key to exit simulation
  useEffect(() => {
    if (!simulation) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // Only exit if no modal/dialog is open
        const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]')
        const hasOpenMenu = document.querySelector('[role="menu"]')
        if (!hasOpenDialog && !hasOpenMenu) {
          handleExit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [simulation, handleExit])

  // If on a project page and simulating for that project, show the banner
  if (!simulation) {
    return null
  }

  return (
    <div className="bg-violet-950/60 border-b border-violet-800/50 px-4 py-2">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-violet-200">
          <Eye className="h-4 w-4 text-violet-400 flex-shrink-0" />
          <span>
            Viewing as{' '}
            <span className="font-semibold" style={{ color: simulation.role.color }}>
              {simulation.role.name}
            </span>{' '}
            &mdash; UI reflects this role&apos;s permissions. API actions still use your real
            permissions.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-violet-400 hidden sm:inline">Press Esc to exit</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="text-violet-200 hover:text-violet-100 hover:bg-violet-900/50 h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Exit simulation
          </Button>
        </div>
      </div>
    </div>
  )
}
