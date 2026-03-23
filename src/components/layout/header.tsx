'use client'

import { LogOut, Shield, SlidersHorizontal, User, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
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
import { useIsDesktop } from '@/hooks/use-media-query'
import { withBasePath } from '@/lib/base-path'
import { getAvatarColor, getInitials } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { GlobalTicketSearch } from './ticket-search'

export function Header() {
  const isDesktop = useIsDesktop()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const currentUser = useCurrentUser()
  const { data: branding } = useBranding()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = withBasePath('/login')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60 lg:px-6">
      {/* Menu toggle button — mobile hamburger is portalled from MobileNav component */}
      {isDesktop ? (
        <Button variant="ghost" size="icon" className="shrink-0" onClick={toggleSidebar}>
          <SidebarToggleIcon isOpen={sidebarOpen} />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      ) : (
        /* Spacer matching the portalled hamburger button size */
        <div className="h-9 w-9 shrink-0" />
      )}

      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold select-none">
        <img
          src={withBasePath(branding?.logoUrl || '/punt-icon.svg')}
          alt={branding?.appName || 'PUNT'}
          className="h-8 w-8 rounded-lg object-contain"
        />
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
              <Button variant="ghost" className="relative h-8 w-8 rounded-full group">
                <Avatar className="h-8 w-8 transition-all duration-200 group-hover:ring-2 group-hover:ring-amber-500/50 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-amber-500/50 group-focus-visible:scale-105">
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
                <Link href={`/users/${currentUser.username}`}>
                  <User className="mr-2 h-4 w-4" />
                  <span>View Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
              >
                <Link href="/account">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Account</span>
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
