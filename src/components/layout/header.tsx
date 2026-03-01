'use client'

import { LogOut, Shield, SlidersHorizontal, User } from 'lucide-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { AnimatedMenuIcon } from '@/components/ui/animated-menu-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarToggleIcon } from '@/components/ui/sidebar-toggle-icon'
import { useBranding } from '@/hooks/queries/use-branding'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useIsMobile } from '@/hooks/use-media-query'
import { getAvatarColor, getInitials } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { GlobalTicketSearch } from './ticket-search'

export function Header() {
  const isMobile = useIsMobile()
  const { sidebarOpen, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUIStore()
  const currentUser = useCurrentUser()
  const { data: branding } = useBranding()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60 lg:px-6">
      {/* Menu toggle button */}
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <AnimatedMenuIcon isOpen={mobileNavOpen} />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="shrink-0" onClick={toggleSidebar}>
          <SidebarToggleIcon isOpen={sidebarOpen} />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}

      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold select-none">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.appName}
            className="h-8 w-8 rounded-lg object-contain"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{
              background: `linear-gradient(to bottom right, ${branding?.logoGradientFrom || '#f59e0b'}, ${branding?.logoGradientTo || '#ea580c'})`,
            }}
          >
            <span className="text-sm font-bold">{branding?.logoLetter || 'P'}</span>
          </div>
        )}
        <span className="hidden text-lg tracking-tight text-white sm:inline-block">
          {branding?.appName || 'PUNT'}
        </span>
      </div>

      {/* Search - show when logged in */}
      {currentUser && (
        <div className="flex flex-1 items-center">
          <GlobalTicketSearch />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* User menu - only show when logged in */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar || undefined} alt={currentUser.name} />
                  <AvatarFallback
                    className="text-xs text-white font-medium"
                    style={{
                      backgroundColor:
                        currentUser.avatarColor ||
                        getAvatarColor(currentUser.id || currentUser.name),
                    }}
                  >
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-zinc-900 border-zinc-800"
              align="end"
              forceMount
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-zinc-100">{currentUser.name}</p>
                  <p className="text-xs text-zinc-400">{currentUser.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                asChild
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
              >
                <Link href="/preferences?tab=profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
              >
                <Link href="/preferences">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  <span>Preferences</span>
                </Link>
              </DropdownMenuItem>
              {currentUser.isSystemAdmin && (
                <DropdownMenuItem
                  asChild
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                >
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:bg-red-950/50 focus:text-red-300 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
