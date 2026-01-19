import { Suspense } from 'react'
import { UserList } from '@/components/admin/user-list'
import { CreateUserDialog } from '@/components/admin/create-user-dialog'

// Force dynamic rendering - child components fetch from database
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">User Management</h1>
          <p className="text-zinc-500">Create and manage user accounts</p>
        </div>
        <CreateUserDialog />
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        }
      >
        <UserList />
      </Suspense>
    </div>
  )
}
