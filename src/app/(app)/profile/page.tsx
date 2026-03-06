import { redirect } from 'next/navigation'

const ACCOUNT_TAB_REDIRECTS: Record<string, string> = {
  profile: '/account/avatar',
  security: '/account/security',
  'claude-chat': '/account/chat',
  mcp: '/account/mcp',
}

const PREFERENCE_TABS = new Set(['general', 'appearance', 'notifications'])

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab && tab in ACCOUNT_TAB_REDIRECTS) {
    redirect(ACCOUNT_TAB_REDIRECTS[tab])
  }

  if (tab && PREFERENCE_TABS.has(tab)) {
    redirect(`/preferences?tab=${tab}`)
  }

  redirect('/account/avatar')
}
