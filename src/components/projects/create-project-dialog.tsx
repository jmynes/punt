'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

// Preset colors for projects
const PROJECT_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
]

interface FormData {
  name: string
  key: string
  description: string
  color: string
}

const DEFAULT_FORM: FormData = {
  name: '',
  key: '',
  description: '',
  color: PROJECT_COLORS[0],
}

export function CreateProjectDialog() {
  const router = useRouter()
  const { createProjectOpen, setCreateProjectOpen, setActiveProjectId } = useUIStore()
  const { addProject, isKeyTaken } = useProjectsStore()
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setCreateProjectOpen(false)
    // Reset form after close animation
    setTimeout(() => {
      setFormData(DEFAULT_FORM)
      setKeyError(null)
    }, 200)
  }, [setCreateProjectOpen])

  // Auto-generate key from name
  const handleNameChange = useCallback(
    (name: string) => {
      setFormData((prev) => {
        // Only auto-generate key if it hasn't been manually edited
        // or if it matches the auto-generated pattern from the previous name
        const autoKey = name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 6)

        const prevAutoKey = prev.name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 6)

        const shouldAutoUpdate = prev.key === '' || prev.key === prevAutoKey

        return {
          ...prev,
          name,
          key: shouldAutoUpdate ? autoKey : prev.key,
        }
      })
    },
    [],
  )

  const handleKeyChange = useCallback((key: string) => {
    const sanitizedKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    setFormData((prev) => ({ ...prev, key: sanitizedKey }))
    setKeyError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    // Validate
    if (!formData.name.trim()) {
      return
    }

    if (!formData.key.trim()) {
      setKeyError('Project key is required')
      return
    }

    if (formData.key.length < 2) {
      setKeyError('Key must be at least 2 characters')
      return
    }

    if (isKeyTaken(formData.key)) {
      setKeyError('This key is already in use')
      return
    }

    setIsSubmitting(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Add project to the store
    const newProject = addProject({
      name: formData.name.trim(),
      key: formData.key.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color,
    })

    // Show success toast
    toast.success('Project created', {
      description: `${newProject.name} (${newProject.key})`,
      duration: 4000,
    })

    setIsSubmitting(false)
    handleClose()

    // Navigate to the new project and set it as active
    setActiveProjectId(newProject.id)
    router.push(`/projects/${newProject.id}/board`)
  }, [formData, isKeyTaken, addProject, handleClose, setActiveProjectId, router])

  const isValid = formData.name.trim().length > 0 && formData.key.trim().length >= 2

  return (
    <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-100">Create New Project</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Create a project to organize your work. You can add team members later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-zinc-300">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Awesome Project"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Project Key */}
          <div className="space-y-2">
            <Label htmlFor="project-key" className="text-zinc-300">
              Project Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-key"
              value={formData.key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="PROJ"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 uppercase"
              disabled={isSubmitting}
              maxLength={10}
            />
            <p className="text-xs text-zinc-500">
              Used as a prefix for ticket IDs (e.g., {formData.key || 'PROJ'}-123)
            </p>
            {keyError && <p className="text-xs text-red-500">{keyError}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="project-description" className="text-zinc-300">
              Description
            </Label>
            <Textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this project..."
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 resize-none"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Project Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`h-8 w-8 rounded-md transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
