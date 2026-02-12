import { Suspense } from 'react'
import { UserList } from '@/components/admin/user-list'

// Force dynamic rendering - child components fetch from database
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="py-6 px-6">
            <div className="mx-auto max-w-4xl space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={`user-skeleton-${i}`}
                  className="h-20 bg-zinc-800/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        }
      >
        <UserList />
      </Suspense>
    </div>
  )
}
