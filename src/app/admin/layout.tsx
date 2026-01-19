import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Settings } from 'lucide-react'

import { requireSystemAdmin } from '@/lib/auth-helpers'
import { Button } from '@/components/ui/button'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireSystemAdmin()
  } catch {
    redirect('/')
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950">
      {/* Admin header */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to app
              </Button>
            </Link>
            <div className="h-6 w-px bg-zinc-700" />
            <h1 className="text-lg font-semibold text-zinc-100">Admin</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                <Users className="h-4 w-4 mr-2" />
                Users
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Admin content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
