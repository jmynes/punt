'use client'

import { useParams } from 'next/navigation'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { RepositoryTab } from '@/components/projects/settings/repository-tab'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsRepositoryPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="repository">
      <RepositoryTab projectId={projectId} projectKey={projectKey} />
    </ProjectSettingsShell>
  )
}
