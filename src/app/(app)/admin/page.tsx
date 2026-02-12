import { Settings, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import { DEMO_TEAM_MEMBERS, DEMO_USER, isDemoMode } from '@/lib/demo/demo-config'

// Force dynamic rendering - this page fetches from database
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  let userCount: number
  let adminCount: number
  let activeCount: number

  if (isDemoMode()) {
    // In demo mode, use hardcoded demo user counts
    const allDemoUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
    userCount = allDemoUsers.length
    adminCount = allDemoUsers.filter((u) => u.isSystemAdmin).length
    activeCount = allDemoUsers.filter((u) => u.isActive).length
  } else {
    ;[userCount, adminCount, activeCount] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isSystemAdmin: true } }),
      db.user.count({ where: { isActive: true } }),
    ])
  }

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={Shield}
        category="Admin"
        title="Dashboard"
        description="System overview and quick actions"
        variant="hero"
        accentColor="purple"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-100">{userCount}</div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-100">{activeCount}</div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Super Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-100">{adminCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/admin/users">
            <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Users className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100">User Management</h3>
                  <p className="text-sm text-zinc-500">Create, edit, and manage user accounts</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Settings className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100">System Settings</h3>
                  <p className="text-sm text-zinc-500">
                    Configure file upload limits and allowed types
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
