'use client'

import { useParams } from 'next/navigation'
import { MembersTab } from '@/components/projects/permissions/members-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsMembersPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="members">
      <MembersTab projectId={projectId} projectKey={projectKey} />
    </ProjectSettingsShell>
  )
}
