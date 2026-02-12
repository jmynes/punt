import { describe, expect, it } from 'vitest'
import {
  createMockLabel,
  createMockSprint,
  createMockTicket,
  createMockUser,
} from '@/__tests__/utils/mocks'
import { render, screen } from '@/__tests__/utils/test-utils'
import type { BacklogColumn } from '@/stores/backlog-store'
import { TicketCell } from '../ticket-cell'

const createColumn = (id: string): BacklogColumn => ({
  id: id as BacklogColumn['id'],
  label: id,
  visible: true,
  width: 100,
  minWidth: 50,
  sortable: true,
})

const mockGetStatusName = (columnId: string) => {
  const names: Record<string, string> = {
    'col-1': 'To Do',
    'col-2': 'In Progress',
    'col-3': 'Done',
  }
  return names[columnId] || 'Unknown'
}

describe('TicketCell', () => {
  describe('type column', () => {
    it('should render type badge', () => {
      const ticket = createMockTicket({ type: 'bug' })
      const { container } = render(
        <TicketCell
          column={createColumn('type')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      // TypeBadge shows icon with title attribute
      expect(container.querySelector('[title="Bug"]')).toBeInTheDocument()
    })
  })

  describe('key column', () => {
    it('should render ticket key with project prefix', () => {
      const ticket = createMockTicket({ number: 42 })
      render(
        <TicketCell
          column={createColumn('key')}
          ticket={ticket}
          projectKey="PROJ"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('PROJ-42')).toBeInTheDocument()
    })
  })

  describe('title column', () => {
    it('should render ticket title', () => {
      const ticket = createMockTicket({ title: 'Fix login bug' })
      render(
        <TicketCell
          column={createColumn('title')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    })

    it('should show subtask count when present', () => {
      const ticket = createMockTicket({
        title: 'Parent task',
        _count: { comments: 0, subtasks: 3, attachments: 0 },
      })
      render(
        <TicketCell
          column={createColumn('title')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('3 subtasks')).toBeInTheDocument()
    })
  })

  describe('status column', () => {
    it('should render status badge with name', () => {
      const ticket = createMockTicket({ columnId: 'col-2' })
      render(
        <TicketCell
          column={createColumn('status')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })
  })

  describe('priority column', () => {
    it('should render priority badge', () => {
      const ticket = createMockTicket({ priority: 'high' })
      render(
        <TicketCell
          column={createColumn('priority')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('High')).toBeInTheDocument()
    })
  })

  describe('assignee column', () => {
    it('should render assignee name when assigned', () => {
      const assignee = createMockUser({ name: 'John Doe' })
      const ticket = createMockTicket({ assignee, assigneeId: assignee.id })
      render(
        <TicketCell
          column={createColumn('assignee')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('should render "Unassigned" when no assignee', () => {
      const ticket = createMockTicket({ assignee: null, assigneeId: null })
      render(
        <TicketCell
          column={createColumn('assignee')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })
  })

  describe('reporter column', () => {
    it('should render creator name', () => {
      const creator = createMockUser({ name: 'Jane Smith' })
      const ticket = createMockTicket({ creator })
      render(
        <TicketCell
          column={createColumn('reporter')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  describe('labels column', () => {
    it('should render labels', () => {
      const labels = [
        createMockLabel({ id: 'l1', name: 'frontend', color: '#ff0000' }),
        createMockLabel({ id: 'l2', name: 'urgent', color: '#00ff00' }),
      ]
      const ticket = createMockTicket({ labels })
      render(
        <TicketCell
          column={createColumn('labels')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('frontend')).toBeInTheDocument()
      expect(screen.getByText('urgent')).toBeInTheDocument()
    })

    it('should show +N for more than 2 labels', () => {
      const labels = [
        createMockLabel({ id: 'l1', name: 'label1' }),
        createMockLabel({ id: 'l2', name: 'label2' }),
        createMockLabel({ id: 'l3', name: 'label3' }),
        createMockLabel({ id: 'l4', name: 'label4' }),
      ]
      const ticket = createMockTicket({ labels })
      render(
        <TicketCell
          column={createColumn('labels')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('+2')).toBeInTheDocument()
    })
  })

  describe('sprint column', () => {
    it('should render sprint name when in sprint', () => {
      const sprint = createMockSprint({ name: 'Sprint 5', status: 'active' })
      const ticket = createMockTicket({ sprint, sprintId: sprint.id })
      render(
        <TicketCell
          column={createColumn('sprint')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('Sprint 5')).toBeInTheDocument()
    })

    it('should render dash when not in sprint', () => {
      const ticket = createMockTicket({ sprint: null, sprintId: null })
      render(
        <TicketCell
          column={createColumn('sprint')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('storyPoints column', () => {
    it('should render story points when set', () => {
      const ticket = createMockTicket({ storyPoints: 8 })
      render(
        <TicketCell
          column={createColumn('storyPoints')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('should render dash when no points', () => {
      const ticket = createMockTicket({ storyPoints: null })
      render(
        <TicketCell
          column={createColumn('storyPoints')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('estimate column', () => {
    it('should render estimate when set', () => {
      const ticket = createMockTicket({ estimate: '2d 4h' })
      render(
        <TicketCell
          column={createColumn('estimate')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('2d 4h')).toBeInTheDocument()
    })
  })

  describe('dueDate column', () => {
    it('should render formatted date', () => {
      // Use explicit time to avoid timezone issues
      const ticket = createMockTicket({ dueDate: new Date('2024-06-15T12:00:00') })
      render(
        <TicketCell
          column={createColumn('dueDate')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('2024-06-15')).toBeInTheDocument()
    })

    it('should render dash when no due date', () => {
      const ticket = createMockTicket({ dueDate: null })
      render(
        <TicketCell
          column={createColumn('dueDate')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('created column', () => {
    it('should render created date', () => {
      // Use explicit time to avoid timezone issues
      const ticket = createMockTicket({ createdAt: new Date('2024-03-20T12:00:00') })
      render(
        <TicketCell
          column={createColumn('created')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('2024-03-20')).toBeInTheDocument()
    })
  })

  describe('updated column', () => {
    it('should render updated date', () => {
      // Use explicit time to avoid timezone issues
      const ticket = createMockTicket({ updatedAt: new Date('2024-04-10T12:00:00') })
      render(
        <TicketCell
          column={createColumn('updated')}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(screen.getByText('2024-04-10')).toBeInTheDocument()
    })
  })

  describe('unknown column', () => {
    it('should render null for unknown column', () => {
      const ticket = createMockTicket()
      const { container } = render(
        <TicketCell
          column={{ ...createColumn('unknown'), id: 'unknown' as BacklogColumn['id'] }}
          ticket={ticket}
          projectKey="TEST"
          getStatusName={mockGetStatusName}
        />,
      )
      expect(container.firstChild).toBeNull()
    })
  })
})
