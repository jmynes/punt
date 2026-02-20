'use client'

import { ChevronDown, Eye, X } from 'lucide-react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { useProjectRoles } from '@/hooks/queries/use-roles'
import { useMyRealPermissions } from '@/hooks/use-permissions'
import { showToast } from '@/lib/toast'
import { useProjectsStore } from '@/stores/projects-store'
import { useRoleSimulationStore } from '@/stores/role-simulation-store'
import { useSettingsStore } from '@/stores/settings-store'

/**
 * Banner displayed when the user is simulating a different role.
 * Shows which role is being simulated and provides a way to exit
 * or switch to a different role directly from the banner.
 *
 * Also handles navigation interception: when the user tries to
 * navigate away from the simulating project, shows a confirmation
 * dialog (or auto-stops based on user preference).
 */
export function RoleSimulationBanner() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const projectKey = params?.projectId as string | undefined
  const { getProjectByKey } = useProjectsStore()

  // Resolve project ID from the URL key
  const project = projectKey ? getProjectByKey(projectKey) : null
  const projectId = project?.id ?? null

  const simulatedRoles = useRoleSimulationStore((s) => s.simulatedRoles)
  const startSimulation = useRoleSimulationStore((s) => s.startSimulation)
  const stopSimulation = useRoleSimulationStore((s) => s.stopSimulation)
  const stopAllSimulations = useRoleSimulationStore((s) => s.stopAllSimulations)
  const pendingNavigation = useRoleSimulationStore((s) => s.pendingNavigation)
  const setPendingNavigation = useRoleSimulationStore((s) => s.setPendingNavigation)

  const warnOnSimulationLeave = useSettingsStore((s) => s.warnOnSimulationLeave)
  const setWarnOnSimulationLeave = useSettingsStore((s) => s.setWarnOnSimulationLeave)

  // Find the active simulation for the current project
  const simulation = projectId ? (simulatedRoles[projectId] ?? null) : null

  // Local state for "don't ask again" checkbox
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // Fetch roles and real permissions for the role switcher
  const { data: roles } = useProjectRoles(projectId ?? '')
  const { data: realPermissions } = useMyRealPermissions(projectId ?? '')

  // Determine which roles the user can simulate
  const simulatableRoles = useMemo(() => {
    if (!roles || !realPermissions) return []
    const userPosition = realPermissions.role.position
    const userIsAdmin = realPermissions.isSystemAdmin
    return roles.filter((role) => userIsAdmin || role.position >= userPosition)
  }, [roles, realPermissions])

  const handleExit = useCallback(() => {
    if (projectId) {
      stopSimulation(projectId)
    }
  }, [projectId, stopSimulation])

  const handleSwitchRole = useCallback(
    (role: (typeof simulatableRoles)[0]) => {
      if (!projectId) return
      startSimulation(
        projectId,
        {
          id: role.id,
          name: role.name,
          color: role.color,
          description: role.description ?? null,
          isDefault: role.isDefault,
          position: role.position,
        },
        role.permissions,
      )
    },
    [projectId, startSimulation],
  )

  // Handlers for the navigation confirmation dialog
  const handleConfirmLeave = useCallback(() => {
    if (!pendingNavigation) return
    const url = pendingNavigation
    if (dontAskAgain) {
      setWarnOnSimulationLeave(false)
    }
    if (projectId) {
      stopSimulation(projectId)
    } else {
      stopAllSimulations()
    }
    setDontAskAgain(false)
    router.push(url)
  }, [
    pendingNavigation,
    dontAskAgain,
    projectId,
    stopSimulation,
    stopAllSimulations,
    setWarnOnSimulationLeave,
    router,
  ])

  const handleCancelLeave = useCallback(() => {
    setPendingNavigation(null)
    setDontAskAgain(false)
  }, [setPendingNavigation])

  // Handle Escape key to exit simulation
  useEffect(() => {
    if (!simulation) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // Only exit if no modal/dialog/overlay is open
        const hasOpenOverlay = document.querySelector(
          '[role="dialog"][data-state="open"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]',
        )
        if (!hasOpenOverlay) {
          handleExit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [simulation, handleExit])

  // Fallback: auto-stop simulation when navigating away via non-sidebar means
  // (e.g., browser back/forward, direct URL entry)
  useEffect(() => {
    const simulatingIds = Object.keys(simulatedRoles)
    if (simulatingIds.length === 0) return
    if (pendingNavigation) return // Dialog is showing, don't auto-stop

    const projects = useProjectsStore.getState().projects
    const isWithinScope = simulatingIds.some((id) => {
      const proj = projects.find((p) => p.id === id)
      if (!proj?.key) return false
      return pathname.startsWith(`/projects/${proj.key}/`) || pathname === `/projects/${proj.key}`
    })

    if (!isWithinScope) {
      stopAllSimulations()
      showToast.info('Role simulation ended')
    }
  }, [pathname, simulatedRoles, pendingNavigation, stopAllSimulations])

  // If not simulating for the current project, don't render
  if (!simulation) {
    return null
  }

  return (
    <>
      <div className="bg-violet-950/60 border-b border-violet-800/50 px-4 py-2">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-violet-200">
            <Eye className="h-4 w-4 text-violet-400 flex-shrink-0" />
            <span>
              Viewing as{' '}
              <span className="font-semibold" style={{ color: simulation.role.color }}>
                {simulation.role.name}
              </span>{' '}
              &mdash; UI reflects this role&apos;s permissions.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-violet-400 hidden sm:inline">Press Esc to exit</span>
            {simulatableRoles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-violet-200 hover:text-violet-100 hover:bg-violet-900/50 h-7 text-xs"
                  >
                    Switch role
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  {simulatableRoles.map((role) => (
                    <DropdownMenuItem
                      key={role.id}
                      onClick={() => handleSwitchRole(role)}
                      disabled={role.id === simulation.role.id}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                      <span>{role.name}</span>
                      {role.id === simulation.role.id && (
                        <span className="text-xs text-muted-foreground ml-auto">(current)</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExit}>
                    <X className="h-3 w-3 mr-2" />
                    Exit simulation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="text-violet-200 hover:text-violet-100 hover:bg-violet-900/50 h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation confirmation dialog */}
      <AlertDialog
        open={!!pendingNavigation}
        onOpenChange={(open) => {
          if (!open) handleCancelLeave()
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Leave role simulation?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You&apos;re viewing as{' '}
              <span className="font-semibold" style={{ color: simulation.role.color }}>
                {simulation.role.name}
              </span>
              . Navigating away from this project will end the simulation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
              className="border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
            />
            <Label
              htmlFor="dont-ask-again"
              className="text-sm text-zinc-400 cursor-pointer font-normal"
            >
              Don&apos;t ask again (auto-stop instead)
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Leave &amp; End Simulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
