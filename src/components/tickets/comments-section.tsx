'use client'

import { formatDistanceToNow } from 'date-fns'
import { Bot, Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  type CommentInfo,
  useAddComment,
  useDeleteComment,
  useTicketComments,
  useUpdateComment,
} from '@/hooks/queries/use-comments'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'

interface CommentsSectionProps {
  projectId: string
  ticketId: string
}

export function CommentsSection({ projectId, ticketId }: CommentsSectionProps) {
  const { data: comments = [], isLoading } = useTicketComments(projectId, ticketId)
  const addComment = useAddComment()
  const updateComment = useUpdateComment()
  const deleteComment = useDeleteComment()
  const currentUser = useCurrentUser()
  const canManageAny = useHasPermission(projectId, PERMISSIONS.COMMENTS_MANAGE_ANY)

  const [newComment, setNewComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [commentToDelete, setCommentToDelete] = useState<CommentInfo | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus edit textarea when editing starts
  useEffect(() => {
    if (editingCommentId && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length,
      )
    }
  }, [editingCommentId])

  const handleAddComment = async () => {
    const content = newComment.trim()
    if (!content) return

    await addComment.mutateAsync({ projectId, ticketId, content })
    setNewComment('')
  }

  const handleStartEdit = (comment: CommentInfo) => {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditContent('')
  }

  const handleSaveEdit = async () => {
    const content = editContent.trim()
    if (!content || !editingCommentId) return

    await updateComment.mutateAsync({
      projectId,
      ticketId,
      commentId: editingCommentId,
      content,
    })
    setEditingCommentId(null)
    setEditContent('')
  }

  const handleDeleteComment = async () => {
    if (!commentToDelete) return

    await deleteComment.mutateAsync({
      projectId,
      ticketId,
      commentId: commentToDelete.id,
    })
    setCommentToDelete(null)
  }

  const canEditComment = (comment: CommentInfo) => {
    if (!currentUser) return false
    // System-generated comments cannot be edited
    if (comment.isSystemGenerated) return false
    return comment.authorId === currentUser.id || canManageAny
  }

  const canDeleteComment = (comment: CommentInfo) => {
    if (!currentUser) return false
    return comment.authorId === currentUser.id || canManageAny
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, isEdit = false) => {
    // Submit on Ctrl/Cmd + Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (isEdit) {
        handleSaveEdit()
      } else {
        handleAddComment()
      }
    }
    // Cancel edit on Escape
    if (e.key === 'Escape' && isEdit) {
      handleCancelEdit()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-800" />
                <div className="h-12 rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing comments */}
      {comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                {comment.author.avatar ? (
                  <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                ) : null}
                <AvatarFallback
                  className={cn(
                    'text-xs font-medium text-white',
                    getAvatarColor(comment.author.username),
                  )}
                >
                  {getInitials(comment.author.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{comment.author.name}</span>
                  <span className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                  {comment.updatedAt !== comment.createdAt && (
                    <span className="text-xs text-zinc-600">(edited)</span>
                  )}
                  {comment.isSystemGenerated && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-500/70">
                      <Bot className="h-3 w-3" />
                      {comment.source || 'system'}
                    </span>
                  )}
                </div>

                {editingCommentId === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      ref={editTextareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, true)}
                      className="resize-none bg-zinc-900 border-zinc-700 focus:border-amber-500"
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim() || updateComment.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <span className="text-xs text-zinc-500 ml-auto">
                        Ctrl+Enter to save, Esc to cancel
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="group relative mt-1">
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>

                    {(canEditComment(comment) || canDeleteComment(comment)) && (
                      <div className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 bg-zinc-800 hover:bg-zinc-700"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                            {canEditComment(comment) && (
                              <DropdownMenuItem
                                onClick={() => handleStartEdit(comment)}
                                className="cursor-pointer"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteComment(comment) && (
                              <DropdownMenuItem
                                onClick={() => setCommentToDelete(comment)}
                                className="cursor-pointer text-red-400 focus:text-red-400"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new comment */}
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="resize-none bg-zinc-900 border-zinc-700 focus:border-amber-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Ctrl+Enter to submit</span>
          <Button
            size="sm"
            variant="primary"
            onClick={handleAddComment}
            disabled={!newComment.trim() || addComment.isPending}
          >
            {addComment.isPending ? 'Adding...' : 'Comment'}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!commentToDelete}
        onOpenChange={(open) => !open && setCommentToDelete(null)}
      >
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
