'use client'

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUIStore } from '@/stores/ui-store'

// Demo stats
const stats = [
  {
    title: 'Open Tickets',
    value: '12',
    change: '+3 this week',
    icon: Layers,
    color: 'text-blue-400',
  },
  {
    title: 'In Progress',
    value: '5',
    change: '2 assigned to you',
    icon: Clock,
    color: 'text-amber-400',
  },
  {
    title: 'Completed',
    value: '34',
    change: '+8 this week',
    icon: CheckCircle2,
    color: 'text-emerald-400',
  },
  {
    title: 'Projects',
    value: '3',
    change: 'Active',
    icon: FolderKanban,
    color: 'text-purple-400',
  },
]

// Demo recent activity
const recentActivity = [
  {
    id: '1',
    type: 'created',
    ticket: 'PUNT-15',
    title: 'Add dark mode toggle',
    user: 'Demo User',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'moved',
    ticket: 'PUNT-12',
    title: 'Fix login redirect',
    user: 'Demo User',
    time: '4 hours ago',
    from: 'In Progress',
    to: 'Done',
  },
  {
    id: '3',
    type: 'comment',
    ticket: 'API-8',
    title: 'Implement rate limiting',
    user: 'Demo User',
    time: '5 hours ago',
  },
]

export default function DashboardPage() {
  const { setCreateTicketOpen, setCreateProjectOpen } = useUIStore()

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto p-4 lg:p-6">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Welcome back! 👋</h1>
        <p className="text-zinc-400">Here&apos;s what&apos;s happening with your projects today.</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => setCreateTicketOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
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
              <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
              <p className="text-xs text-zinc-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent Activity</CardTitle>
            <CardDescription className="text-zinc-500">Your latest ticket updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {activity.type === 'created' && <Plus className="h-4 w-4 text-emerald-400" />}
                    {activity.type === 'moved' && <ArrowRight className="h-4 w-4 text-blue-400" />}
                    {activity.type === 'comment' && (
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">
                      <span className="font-mono text-amber-400">{activity.ticket}</span>{' '}
                      {activity.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {activity.type === 'moved'
                        ? `Moved from ${activity.from} to ${activity.to}`
                        : activity.type === 'created'
                          ? 'Created'
                          : 'Commented'}
                      {' · '}
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Your Projects</CardTitle>
            <CardDescription className="text-zinc-500">Jump back into your work</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: '1', name: 'PUNT', key: 'PUNT', color: '#f59e0b', tickets: 15 },
                { id: '2', name: 'Backend API', key: 'API', color: '#10b981', tickets: 8 },
                { id: '3', name: 'Mobile App', key: 'MOB', color: '#8b5cf6', tickets: 5 },
              ].map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/board`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors group"
                >
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.key.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{project.name}</p>
                    <p className="text-xs text-zinc-500">{project.tickets} open tickets</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
