'use client'

import { useParams } from 'next/navigation'
import { GeneralTab } from '@/components/projects/settings/general-tab'
import { ProjectSettingsShell } from '@/components/projects/settings/project-settings-shell'
import { useProjectsStore } from '@/stores/projects-store'

export default function ProjectSettingsGeneralPage() {
  const params = useParams()
  const projectKey = params.projectId as string
  const project = useProjectsStore((s) => s.getProjectByKey(projectKey))
  const projectId = project?.id || projectKey

  return (
    <ProjectSettingsShell tab="general">
      {project && (
        <GeneralTab
          projectId={projectId}
          project={{
            id: project.id,
            name: project.name,
            key: project.key,
            description: project.description || null,
            color: project.color,
          }}
        />
      )}
    </ProjectSettingsShell>
  )
}
