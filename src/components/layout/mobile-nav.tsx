'use client'

import { FileText, FolderKanban, Home, Layers, Plus, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

// Demo projects - same as sidebar
const demoProjects = [
  { id: '1', name: 'PUNT', key: 'PUNT', color: '#f59e0b' },
  { id: '2', name: 'Backend API', key: 'API', color: '#10b981' },
  { id: '3', name: 'Mobile App', key: 'MOB', color: '#8b5cf6' },
]

export function MobileNav() {
  const pathname = usePathname()
  const {
    mobileNavOpen,
    setMobileNavOpen,
    activeProjectId,
    setActiveProjectId,
    setCreateProjectOpen,
  } = useUIStore()

  const handleLinkClick = () => {
    setMobileNavOpen(false)
  }

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-80 border-zinc-800 bg-zinc-950 p-0">
        <SheetHeader className="border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <span className="text-sm font-bold">P</span>
              </div>
              <SheetTitle className="text-lg text-white">PUNT</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="px-3 py-4">
            {/* Main navigation */}
            <div className="space-y-1">
              <Link href="/" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                    pathname === '/' && 'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/projects" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                    pathname === '/projects' && 'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <FolderKanban className="h-4 w-4" />
                  All Projects
                </Button>
              </Link>
              <Link href="/editor-test" onClick={handleLinkClick}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                    pathname === '/editor-test' && 'bg-zinc-800/50 text-zinc-100',
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Editor Test
                </Button>
              </Link>
              <Link href="/settings" onClick={handleLinkClick}>
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
                  onClick={() => {
                    setCreateProjectOpen(true)
                    setMobileNavOpen(false)
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-1">
                {demoProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}/board`}
                    onClick={() => {
                      setActiveProjectId(project.id)
                      handleLinkClick()
                    }}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
                        activeProjectId === project.id && 'bg-zinc-800/50 text-zinc-100',
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
                ))}
              </div>
            </div>

            {/* Quick access when project selected */}
            {activeProjectId && (
              <div className="mt-4 ml-4 space-y-1 border-l border-zinc-800 pl-3">
                <Link href={`/projects/${activeProjectId}/board`} onClick={handleLinkClick}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Board
                  </Button>
                </Link>
                <Link href={`/projects/${activeProjectId}/settings`} onClick={handleLinkClick}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-zinc-400 hover:text-zinc-100"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
