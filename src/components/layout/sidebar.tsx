'use client'

import { Check, FileText, FolderKanban, Home, Layers, List, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: Home },
  { title: 'All Projects', href: '/projects', icon: FolderKanban },
  { title: 'Editor Test', href: '/editor-test', icon: FileText },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setCreateProjectOpen, activeProjectId, setActiveProjectId, openEditProject } = useUIStore()
  const { projects, _hasHydrated, removeProject } = useProjectsStore()
  const [editMode, setEditMode] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)

  const projectToDelete = deleteProjectId ? projects.find((p) => p.id === deleteProjectId) : null

  const handleDeleteProject = () => {
    if (!deleteProjectId || !projectToDelete) return
    removeProject(deleteProjectId)
    toast.success('Project deleted', {
      description: projectToDelete.name,
    })
    setDeleteProjectId(null)
  }

  if (!sidebarOpen) {
    return null
  }

  return (
    <>
    <aside className="hidden lg:flex h-[calc(100vh-3.5rem)] w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <ScrollArea className="flex-1 px-3 py-4">
        {/* Main navigation */}
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                    isActive && 'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </div>

        {/* Projects section */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Projects
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  editMode
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 rounded-sm'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Pencil className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
                onClick={() => setCreateProjectOpen(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            {!_hasHydrated ? (
              // Show skeleton while hydrating to avoid SSR mismatch
              <>
                <Skeleton className="h-9 w-full bg-zinc-800" />
                <Skeleton className="h-9 w-full bg-zinc-800" />
                <Skeleton className="h-9 w-full bg-zinc-800" />
              </>
            ) : (
              projects.map((project) => {
                const isActive = activeProjectId === project.id
                return (
                  <div key={project.id} className="relative flex items-center">
                    <Link
                      href={`/projects/${project.id}/board`}
                      onClick={() => setActiveProjectId(project.id)}
                      className="flex-1"
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                          isActive && 'bg-zinc-800/50 text-zinc-100',
                        )}
                      >
                        <div
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate">{project.name}</span>
                        {!editMode && (
                          <span className="ml-auto text-xs text-zinc-600">{project.key}</span>
                        )}
                      </Button>
                    </Link>
                    {editMode && (
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openEditProject(project.id)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-500 hover:text-red-400"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDeleteProjectId(project.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Project sub-nav when project is selected */}
        {activeProjectId && (
          <div className="mt-4 ml-4 space-y-1 border-l border-zinc-800 pl-3">
            <Link href={`/projects/${activeProjectId}/board`}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100',
                  pathname.includes('/board') && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Board
              </Button>
            </Link>
            <Link href={`/projects/${activeProjectId}/backlog`}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100',
                  pathname.includes('/backlog') && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <List className="h-3.5 w-3.5" />
                Backlog
              </Button>
            </Link>
            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100',
                  pathname === '/settings' && 'bg-zinc-800/50 text-zinc-100',
                )}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Button>
            </Link>
          </div>
        )}
      </ScrollArea>

      {/* Bottom section */}
      <div className="border-t border-zinc-800 p-3">
        <Link href="/settings">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
              pathname === '/settings' && 'bg-zinc-800/50 text-zinc-100',
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>
    </aside>

    {/* Delete confirmation dialog */}
    <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
      <AlertDialogContent className="bg-zinc-950 border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-zinc-100">Delete Project?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This will remove
            the project and all its tickets. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteProject}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
