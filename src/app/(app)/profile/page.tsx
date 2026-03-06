import { redirect } from 'next/navigation'

const ACCOUNT_TABS = new Set(['profile', 'security', 'claude-chat', 'mcp'])
const PREFERENCE_TABS = new Set(['general', 'appearance', 'notifications'])

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab && ACCOUNT_TABS.has(tab)) {
    redirect(`/account/${tab}`)
  }

  if (tab && PREFERENCE_TABS.has(tab)) {
    redirect(`/preferences?tab=${tab}`)
  }

  redirect('/account/profile')
}
