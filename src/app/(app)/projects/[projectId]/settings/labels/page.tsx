'use client'

import { useParams } from 'next/navigation'
import { LabelsTab } from '@/components/projects/settings/labels-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsLabelsPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="labels">
      <LabelsTab projectId={projectId} />
    </ProjectSettingsShell>
  )
}
