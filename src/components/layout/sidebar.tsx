'use client'

import { FileText, FolderKanban, Home, Layers, List, Plus, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
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

// Demo projects - in real app, these come from API
const demoProjects = [
  { id: '1', name: 'PUNT', key: 'PUNT', color: '#f59e0b' },
  { id: '2', name: 'Backend API', key: 'API', color: '#10b981' },
  { id: '3', name: 'Mobile App', key: 'MOB', color: '#8b5cf6' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setCreateProjectOpen, activeProjectId, setActiveProjectId } = useUIStore()

  if (!sidebarOpen) {
    return null
  }

  return (
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
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1">
            {demoProjects.map((project) => {
              const isActive = activeProjectId === project.id
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/board`}
                  onClick={() => setActiveProjectId(project.id)}
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
                    <span className="ml-auto text-xs text-zinc-600">{project.key}</span>
                  </Button>
                </Link>
              )
            })}
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
  )
}
