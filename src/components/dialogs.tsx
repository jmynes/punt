'use client'

import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { EditProjectDialog } from '@/components/projects/edit-project-dialog'
import { SprintCompleteDialog, SprintCreateDialog, SprintStartDialog } from '@/components/sprints'
import { CreateTicketDialog } from '@/components/tickets'
import { useUIStore } from '@/stores/ui-store'

export function Dialogs() {
  const { activeProjectId } = useUIStore()

  return (
    <>
      <CreateTicketDialog />
      <CreateProjectDialog />
      <EditProjectDialog />
      {/* Sprint dialogs - only rendered when a project is active */}
      {activeProjectId && (
        <>
          <SprintCreateDialog projectId={activeProjectId} />
          <SprintCompleteDialog projectId={activeProjectId} />
          <SprintStartDialog projectId={activeProjectId} />
        </>
      )}
    </>
  )
}
