'use client'

import { useParams } from 'next/navigation'
import { RolesTab } from '@/components/projects/permissions/roles-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsRolesPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="roles">
      <RolesTab projectId={projectId} projectKey={projectKey} />
    </ProjectSettingsShell>
  )
}
