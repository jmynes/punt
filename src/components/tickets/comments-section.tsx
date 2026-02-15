'use client'

import { formatDistanceToNow } from 'date-fns'
import { Bot, Check, Pencil, Trash2, X } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
  ticketKey: string
  onPendingCommentChange?: (hasPending: boolean) => void
}

export interface CommentsSectionRef {
  submitPendingComment: () => Promise<void>
  discardPendingComment: () => void
  hasPendingComment: () => boolean
}

export const CommentsSection = forwardRef<CommentsSectionRef, CommentsSectionProps>(
  function CommentsSection({ projectId, ticketId, ticketKey, onPendingCommentChange }, ref) {
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

    // Notify parent when pending comment state changes
    useEffect(() => {
      onPendingCommentChange?.(!!newComment.trim())
    }, [newComment, onPendingCommentChange])

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

      await addComment.mutateAsync({ projectId, ticketId, ticketKey, content })
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
        ticketKey,
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
        ticketKey,
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
    }

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      submitPendingComment: async () => {
        if (newComment.trim()) {
          await handleAddComment()
        }
      },
      discardPendingComment: () => {
        setNewComment('')
      },
      hasPendingComment: () => !!newComment.trim(),
    }))

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

                <div className="group relative flex-1 min-w-0">
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

                  {(canEditComment(comment) || canDeleteComment(comment)) && !editingCommentId && (
                    <div className="absolute right-0 top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEditComment(comment) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          onClick={() => handleStartEdit(comment)}
                          title="Edit comment"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {canDeleteComment(comment) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                          onClick={() => setCommentToDelete(comment)}
                          title="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}

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
                        <span className="text-xs text-zinc-500 ml-auto">Ctrl+Enter to save</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
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
            <div className="flex items-center gap-2">
              {newComment.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNewComment('')}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
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
  },
)
