'use client'

import {
  CreateLink,
  InsertImage,
  openLinkEditDialog$,
  openNewImageDialog$,
  usePublisher,
} from '@mdxeditor/editor'
import { ChevronDown, Image, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ResponsiveLinkImageToggle() {
  const isSmallScreen = useMediaQuery('(max-width: 1024px)')
  const openLinkDialog = usePublisher(openLinkEditDialog$)
  const openImageDialog = usePublisher(openNewImageDialog$)

  if (isSmallScreen) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 relative flex items-center justify-center"
          >
            <Link className="h-4 w-4 shrink-0 text-current" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5 shrink-0 pointer-events-none text-current opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700" align="start">
          <DropdownMenuItem
            onClick={() => openLinkDialog()}
            className="text-zinc-300 focus:bg-zinc-800"
          >
            <Link className="h-4 w-4 mr-2" />
            Link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openImageDialog()}
            className="text-zinc-300 focus:bg-zinc-800"
          >
            <Image className="h-4 w-4 mr-2" />
            Image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Show as individual buttons on larger screens
  return (
    <>
      <CreateLink />
      <InsertImage />
    </>
  )
}
