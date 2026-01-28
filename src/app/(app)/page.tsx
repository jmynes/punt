'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Clock, FolderKanban, Layers, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjects } from '@/hooks/queries/use-projects'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

interface DashboardStats {
  openTickets: number
  inProgress: number
  completed: number
}

export default function DashboardPage() {
  const { setCreateTicketOpen, setCreateProjectOpen } = useUIStore()
  const hasShownRedirectToast = useRef(false)

  // Fetch projects from database
  useProjects()
  const { projects, isLoading } = useProjectsStore()

  // Fetch dashboard stats from server
  const { data: serverStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      // Demo mode: calculate stats from localStorage
      if (isDemoMode()) {
        const projects = demoStorage.getProjects()
        let openTickets = 0
        let inProgress = 0
        let completed = 0

        for (const project of projects) {
          const columns = demoStorage.getColumns(project.id)
          const tickets = demoStorage.getTickets(project.id)

          for (const column of columns) {
            const colName = column.name.toLowerCase()
            const columnTickets = tickets.filter((t) => t.columnId === column.id)

            if (colName === 'done' || colName === 'completed') {
              completed += columnTickets.length
            } else if (colName.includes('progress') || colName === 'in progress') {
              inProgress += columnTickets.length
            } else {
              openTickets += columnTickets.length
            }
          }
        }

        return { openTickets, inProgress, completed }
      }

      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard stats')
      }
      return res.json()
    },
    staleTime: 1000 * 30, // 30 seconds
  })

  // Build stats array from server data
  const stats = useMemo(() => {
    const openTickets = serverStats?.openTickets ?? 0
    const inProgress = serverStats?.inProgress ?? 0
    const completed = serverStats?.completed ?? 0

    return [
      {
        title: 'Open Tickets',
        value: openTickets.toString(),
        change: openTickets > 0 ? 'In backlog & todo' : 'No tickets yet',
        icon: Layers,
        color: 'text-blue-400',
      },
      {
        title: 'In Progress',
        value: inProgress.toString(),
        change: inProgress > 0 ? 'Being worked on' : 'None in progress',
        icon: Clock,
        color: 'text-amber-400',
      },
      {
        title: 'Completed',
        value: completed.toString(),
        change: completed > 0 ? 'Done' : 'No completed tickets',
        icon: CheckCircle2,
        color: 'text-emerald-400',
      },
      {
        title: 'Projects',
        value: projects.length.toString(),
        change: projects.length > 0 ? 'Active' : 'Create your first project',
        icon: FolderKanban,
        color: 'text-purple-400',
      },
    ]
  }, [serverStats, projects.length])

  // Show toast if redirected from invalid route
  useEffect(() => {
    if (typeof window === 'undefined') return

    const invalidPath = sessionStorage.getItem('punt:invalidPath')

    if (invalidPath && !hasShownRedirectToast.current) {
      hasShownRedirectToast.current = true
      toast.error('404 - Page Not Found', {
        description: `The page "${invalidPath}" doesn't exist. You've been redirected to the dashboard.`,
        duration: 5000,
      })

      // Clean up sessionStorage
      sessionStorage.removeItem('punt:invalidPath')
    }
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Welcome back!</h1>
        <p className="text-zinc-400">Here&apos;s what&apos;s happening with your projects today.</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        {projects.length > 0 && (
          <Button variant="primary" onClick={() => setCreateTicketOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        )}
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => setCreateProjectOpen(true)}
        >
          <FolderKanban className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading || statsLoading ? (
                <Skeleton className="h-8 w-16 bg-zinc-800" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
                  <p className="text-xs text-zinc-500 mt-1">{stat.change}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity - placeholder for now */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent Activity</CardTitle>
            <CardDescription className="text-zinc-500">Your latest ticket updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-zinc-700 mb-3" />
              <p className="text-zinc-400 text-sm">No recent activity</p>
              <p className="text-zinc-500 text-xs mt-1">
                Activity will appear here as you work on tickets
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Your Projects */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Your Projects</CardTitle>
            <CardDescription className="text-zinc-500">Jump back into your work</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full bg-zinc-800" />
                <Skeleton className="h-16 w-full bg-zinc-800" />
                <Skeleton className="h-16 w-full bg-zinc-800" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="h-12 w-12 text-zinc-700 mb-3" />
                <p className="text-zinc-400 text-sm">No projects yet</p>
                <p className="text-zinc-500 text-xs mt-1 mb-4">
                  Create your first project to get started
                </p>
                <Button size="sm" variant="primary" onClick={() => setCreateProjectOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Project
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => {
                  const ticketCount = project._count?.tickets ?? 0
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}/board`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors group"
                    >
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none"
                        style={{ backgroundColor: project.color }}
                      >
                        {project.key.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200">{project.name}</p>
                        <p className="text-xs text-zinc-500">
                          {ticketCount === 0
                            ? 'No tickets'
                            : ticketCount === 1
                              ? '1 ticket'
                              : `${ticketCount} tickets`}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
