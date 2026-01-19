'use client'

import { LogOut, Menu, Plus, Search, Settings, Shield, User } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useIsMobile } from '@/hooks/use-media-query'
import { getAvatarColor, getInitials } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

export function Header() {
  const isMobile = useIsMobile()
  const { toggleSidebar, setMobileNavOpen, setCreateTicketOpen } = useUIStore()
  const currentUser = useCurrentUser()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60 lg:px-6">
      {/* Mobile menu button */}
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="shrink-0" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}

      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <span className="text-sm font-bold">P</span>
        </div>
        <span className="hidden text-lg tracking-tight text-white sm:inline-block">PUNT</span>
      </div>

      {/* Search - hidden on mobile, only show when logged in */}
      {currentUser && (
        <div className="hidden flex-1 md:block">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input type="search" placeholder="Search tickets..." className="pl-10" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create button - only show when logged in */}
        {currentUser && (
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => setCreateTicketOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        )}

        {/* User menu - only show when logged in */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar || undefined} alt={currentUser.name} />
                  <AvatarFallback
                    className="text-xs text-white font-medium"
                    style={{ backgroundColor: getAvatarColor(currentUser.id || currentUser.name) }}
                  >
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-zinc-100">{currentUser.name}</p>
                  <p className="text-xs text-zinc-400">{currentUser.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem asChild className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer">
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              {currentUser.isSystemAdmin && (
                <DropdownMenuItem asChild className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer">
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
