import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { UserList } from '@/components/admin/user-list'
import { CreateUserDialog } from '@/components/admin/create-user-dialog'

// Force dynamic rendering - child components fetch from database
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6">
        {/* Header - fixed */}
        <div className="flex items-center justify-between py-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
          </div>
          <CreateUserDialog />
        </div>

        {/* User List - scrollable */}
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

        {/* Footer spacer */}
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
