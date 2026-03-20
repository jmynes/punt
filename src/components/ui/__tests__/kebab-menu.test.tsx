import userEvent from '@testing-library/user-event'
import { Pencil, Trash2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/__tests__/utils/test-utils'
import { type KebabAction, KebabMenu } from '../kebab-menu'

const editAction: KebabAction = {
  icon: Pencil,
  label: 'Edit',
  onClick: vi.fn(),
}

const deleteAction: KebabAction = {
  icon: Trash2,
  label: 'Delete',
  onClick: vi.fn(),
  variant: 'destructive',
}

describe('KebabMenu', () => {
  it('renders trigger button', () => {
    render(<KebabMenu actions={[editAction]} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows menu items on click', async () => {
    render(<KebabMenu actions={[editAction, deleteAction]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onClick handler', async () => {
    const onClick = vi.fn()
    render(<KebabMenu actions={[{ ...editAction, onClick }]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    await userEvent.setup().click(screen.getByText('Edit'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders separator before destructive items', async () => {
    render(<KebabMenu actions={[editAction, deleteAction]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('does not render separator between consecutive destructive items', async () => {
    const secondDelete: KebabAction = {
      icon: Trash2,
      label: 'Remove',
      onClick: vi.fn(),
      variant: 'destructive',
    }
    render(<KebabMenu actions={[deleteAction, secondDelete]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('returns null for empty actions', () => {
    const { container } = render(<KebabMenu actions={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('filters out null and undefined actions', async () => {
    render(<KebabMenu actions={[null, editAction, undefined]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('applies destructive styling', async () => {
    render(<KebabMenu actions={[deleteAction]} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByText('Delete').closest('[role="menuitem"]')).toHaveClass('text-red-400')
  })
})
