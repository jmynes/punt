import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-helpers'
import { DEMO_USER, isDemoMode } from '@/lib/demo'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  let username: string
  if (isDemoMode()) {
    username = DEMO_USER.username
  } else {
    const user = await getCurrentUser()
    if (!user || !('username' in user) || !user.username) {
      redirect('/login')
    }
    username = user.username
  }

  const tabParam = tab ? `?tab=${tab}` : ''
  redirect(`/users/${username}${tabParam}`)
}
