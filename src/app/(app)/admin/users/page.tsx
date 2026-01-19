import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { UserList } from '@/components/admin/user-list'
import { CreateUserDialog } from '@/components/admin/create-user-dialog'

// Force dynamic rendering - child components fetch from database
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
          </div>
          <CreateUserDialog />
        </div>

        {/* User List */}
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
    </div>
  )
}
