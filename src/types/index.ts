// Re-export Prisma types
export type {
	Column,
	Comment,
	Label,
	Project,
	ProjectMember,
	Ticket,
	User,
} from '@/generated/prisma'

// Priority levels for tickets
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

// Project member roles
export const ROLES = ['owner', 'admin', 'member'] as const
export type Role = (typeof ROLES)[number]

// Extended types with relations
export interface TicketWithRelations {
	id: string
	number: number
	title: string
	description: string | null
	priority: Priority
	order: number
	createdAt: Date
	updatedAt: Date
	projectId: string
	columnId: string
	assigneeId: string | null
	creatorId: string
	assignee: {
		id: string
		name: string
		avatar: string | null
	} | null
	creator: {
		id: string
		name: string
		avatar: string | null
	}
	labels: {
		id: string
		name: string
		color: string
	}[]
}

export interface ColumnWithTickets {
	id: string
	name: string
	order: number
	projectId: string
	tickets: TicketWithRelations[]
}

export interface ProjectWithDetails {
	id: string
	name: string
	key: string
	description: string | null
	color: string
	createdAt: Date
	updatedAt: Date
	columns: ColumnWithTickets[]
	members: {
		id: string
		role: Role
		user: {
			id: string
			name: string
			email: string
			avatar: string | null
		}
	}[]
	labels: {
		id: string
		name: string
		color: string
	}[]
	_count: {
		tickets: number
	}
}
