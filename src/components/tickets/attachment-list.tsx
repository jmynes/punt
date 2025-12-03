'use client'

import {
	Download,
	ExternalLink,
	FileImage,
	FileText,
	FileVideo,
	MoreHorizontal,
	Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UploadedFile } from './file-upload'

interface AttachmentListProps {
	attachments: UploadedFile[]
	onRemove?: (fileId: string) => void
	readonly?: boolean
	layout?: 'list' | 'grid'
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(category: 'image' | 'video' | 'document') {
	switch (category) {
		case 'image':
			return FileImage
		case 'video':
			return FileVideo
		default:
			return FileText
	}
}

export function AttachmentList({
	attachments,
	onRemove,
	readonly = false,
	layout = 'list',
}: AttachmentListProps) {
	const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)

	if (attachments.length === 0) {
		return null
	}

	const handleDownload = (file: UploadedFile) => {
		const link = document.createElement('a')
		link.href = file.url
		link.download = file.originalName
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	const handleOpenExternal = (file: UploadedFile) => {
		window.open(file.url, '_blank')
	}

	if (layout === 'grid') {
		return (
			<>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
					{attachments.map((file) => {
						const Icon = getFileIcon(file.category)
						return (
							<div
								key={file.id}
								className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
							>
								{file.category === 'image' ? (
									<img
										src={file.url}
										alt={file.originalName}
										className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
										onClick={() => setPreviewFile(file)}
									/>
								) : file.category === 'video' ? (
									<video
										src={file.url}
										className="h-full w-full cursor-pointer object-cover"
										onClick={() => setPreviewFile(file)}
									>
										<track kind="captions" />
									</video>
								) : (
									<button
										type="button"
										className="flex h-full w-full cursor-pointer flex-col items-center justify-center p-4"
										onClick={() => handleOpenExternal(file)}
									>
										<Icon className="h-8 w-8 text-zinc-500" />
										<p className="mt-2 truncate text-xs text-zinc-400">{file.originalName}</p>
									</button>
								)}

								{/* Overlay actions */}
								<div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8 text-white hover:bg-white/20"
										onClick={() => handleDownload(file)}
									>
										<Download className="h-4 w-4" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8 text-white hover:bg-white/20"
										onClick={() => handleOpenExternal(file)}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
									{!readonly && onRemove && (
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 text-white hover:bg-red-500/50"
											onClick={() => onRemove(file.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
								</div>
							</div>
						)
					})}
				</div>

				{/* Preview dialog */}
				<Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
					<DialogContent className="max-w-4xl border-zinc-800 bg-zinc-950 p-0">
						<DialogHeader className="sr-only">
							<DialogTitle>{previewFile?.originalName}</DialogTitle>
							<DialogDescription>File preview</DialogDescription>
						</DialogHeader>
						{previewFile?.category === 'image' && (
							<img
								src={previewFile.url}
								alt={previewFile.originalName}
								className="max-h-[80vh] w-full object-contain"
							/>
						)}
						{previewFile?.category === 'video' && (
							<video src={previewFile.url} controls autoPlay className="max-h-[80vh] w-full">
								<track kind="captions" />
							</video>
						)}
					</DialogContent>
				</Dialog>
			</>
		)
	}

	// List layout
	return (
		<>
			<div className="space-y-2">
				{attachments.map((file) => {
					const Icon = getFileIcon(file.category)
					return (
						<div
							key={file.id}
							className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-2"
						>
							{/* Preview thumbnail */}
							{file.category === 'image' ? (
								<button
									type="button"
									className="h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded bg-zinc-800"
									onClick={() => setPreviewFile(file)}
								>
									<img
										src={file.url}
										alt={file.originalName}
										className="h-full w-full object-cover"
									/>
								</button>
							) : file.category === 'video' ? (
								<button
									type="button"
									className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded bg-zinc-800"
									onClick={() => setPreviewFile(file)}
								>
									<video src={file.url} className="h-full w-full object-cover">
										<track kind="captions" />
									</video>
									<div className="absolute inset-0 flex items-center justify-center bg-black/30">
										<FileVideo className="h-5 w-5 text-white" />
									</div>
								</button>
							) : (
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-800">
									<Icon className="h-6 w-6 text-zinc-400" />
								</div>
							)}

							{/* File info */}
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-zinc-200">{file.originalName}</p>
								<p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
							</div>

							{/* Actions */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
									<DropdownMenuItem onClick={() => handleDownload(file)} className="cursor-pointer">
										<Download className="mr-2 h-4 w-4" />
										Download
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => handleOpenExternal(file)}
										className="cursor-pointer"
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										Open in new tab
									</DropdownMenuItem>
									{(file.category === 'image' || file.category === 'video') && (
										<DropdownMenuItem
											onClick={() => setPreviewFile(file)}
											className="cursor-pointer"
										>
											<FileImage className="mr-2 h-4 w-4" />
											Preview
										</DropdownMenuItem>
									)}
									{!readonly && onRemove && (
										<DropdownMenuItem
											onClick={() => onRemove(file.id)}
											className="cursor-pointer text-red-400 focus:text-red-400"
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Remove
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)
				})}
			</div>

			{/* Preview dialog */}
			<Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
				<DialogContent className="max-w-4xl border-zinc-800 bg-zinc-950 p-0">
					<DialogHeader className="sr-only">
						<DialogTitle>{previewFile?.originalName}</DialogTitle>
						<DialogDescription>File preview</DialogDescription>
					</DialogHeader>
					{previewFile?.category === 'image' && (
						<img
							src={previewFile.url}
							alt={previewFile.originalName}
							className="max-h-[80vh] w-full object-contain"
						/>
					)}
					{previewFile?.category === 'video' && (
						<video src={previewFile.url} controls autoPlay className="max-h-[80vh] w-full">
							<track kind="captions" />
						</video>
					)}
				</DialogContent>
			</Dialog>
		</>
	)
}
