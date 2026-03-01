import { redirect } from 'next/navigation'

export default async function AdminUserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { username } = await params
  const resolvedSearchParams = await searchParams

  // Preserve query params (from, projectKey, tab)
  const queryParts: string[] = []
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value !== undefined) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

  redirect(`/users/${username}${queryString}`)
}
