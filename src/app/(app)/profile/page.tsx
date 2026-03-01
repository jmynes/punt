import { redirect } from 'next/navigation'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const tabParam = tab ? `?tab=${tab}` : ''
  redirect(`/preferences${tabParam}`)
}
