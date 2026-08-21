'use client'

import { useParams } from 'next/navigation'
import { ImportTab } from '@/components/projects/settings/import-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsImportPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="import">
      <ImportTab projectId={projectId} />
    </ProjectSettingsShell>
  )
}
