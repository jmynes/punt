import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { requireSystemAdmin } from '@/lib/auth-helpers'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireSystemAdmin()
  } catch {
    redirect('/')
  }

  return <>{children}</>
}
