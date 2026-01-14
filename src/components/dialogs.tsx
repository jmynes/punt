'use client'

import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { CreateTicketDialog } from '@/components/tickets'

export function Dialogs() {
  return (
    <>
      <CreateTicketDialog />
      <CreateProjectDialog />
    </>
  )
}
