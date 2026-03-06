'use client'

import { useParams } from 'next/navigation'
import { AgentsTab } from '@/components/projects/settings/agents-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsAgentsPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="agents">
      <AgentsTab projectId={projectId} projectKey={projectKey} />
    </ProjectSettingsShell>
  )
}
