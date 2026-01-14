'use client'

import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { EditProjectDialog } from '@/components/projects/edit-project-dialog'
import { CreateTicketDialog } from '@/components/tickets'

export function Dialogs() {
  return (
    <>
      <CreateTicketDialog />
      <CreateProjectDialog />
      <EditProjectDialog />
    </>
  )
}
