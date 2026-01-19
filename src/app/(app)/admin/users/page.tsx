import { Users } from 'lucide-react'
import { Suspense } from 'react'
import { UserList } from '@/components/admin/user-list'

// Force dynamic rendering - child components fetch from database
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6">
        {/* User List with header - scrollable */}
        <Suspense
          fallback={
            <div className="py-6">
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-6 w-6 text-amber-500" />
                <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
              </div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
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
