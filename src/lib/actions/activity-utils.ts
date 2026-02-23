import { getTabId } from '@/hooks/use-realtime'
import type { ActivityMeta } from '@/stores/undo-store'

/**
 * Delete activity entries for an undone action.
 * Sends a request to the batch-delete endpoint to remove activity entries
 * that were created by the original action.
 *
 * @param projectKey - The project key (e.g., "PUNT")
 * @param activityMeta - The activity metadata from the undo entry
 */
export async function deleteActivityEntries(
  projectKey: string,
  activityMeta: ActivityMeta,
): Promise<void> {
  const { ticketId, groupId, activityIds } = activityMeta

  // Need ticketId for the API endpoint
  if (!ticketId) {
    return
  }

  // Need either groupId or activityIds to delete
  if (!groupId && (!activityIds || activityIds.length === 0)) {
    return
  }

  try {
    await fetch(`/api/projects/${projectKey}/tickets/${ticketId}/activity/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tab-Id': getTabId(),
      },
      body: JSON.stringify({
        groupId,
        activityIds,
      }),
    })
  } catch (error) {
    // Log but don't throw - activity cleanup should never block the undo operation
    console.error('Failed to delete activity entries:', error)
  }
}

/**
 * Extract activity metadata from an API response.
 * Returns the _activity field if present, otherwise undefined.
 */
export function extractActivityMeta(
  response: { _activity?: { activityIds?: string[]; groupId?: string | null } },
  ticketId: string,
): ActivityMeta | undefined {
  if (!response._activity) {
    return undefined
  }

  const { activityIds, groupId } = response._activity

  // Only return meta if there's something to track
  if ((!activityIds || activityIds.length === 0) && !groupId) {
    return undefined
  }

  return {
    ticketId,
    activityIds: activityIds ?? [],
    groupId: groupId ?? undefined,
  }
}
