import Link from 'next/link'
import { Users, Shield } from 'lucide-react'

import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Force dynamic rendering - this page fetches from database
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [userCount, adminCount, activeCount] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isSystemAdmin: true } }),
    db.user.count({ where: { isActive: true } }),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Admin Dashboard</h1>
        <p className="text-zinc-500">Manage users and system settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <CardTitle className="text-sm font-medium text-zinc-400">System Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-100">{adminCount}</div>
          </CardContent>
        </Card>
      </div>

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
      </div>
    </div>
  )
}
