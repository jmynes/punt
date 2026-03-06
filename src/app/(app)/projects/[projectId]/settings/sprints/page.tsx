'use client'

import { useParams } from 'next/navigation'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { SprintsTab } from '@/components/projects/settings/sprints-tab'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsSprintsPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="sprints">
      <SprintsTab projectId={projectId} projectKey={projectKey} />
    </ProjectSettingsShell>
  )
}
