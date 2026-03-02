import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { TypeBadge } from '@/components/tickets/type-badge'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { UserAvatar } from '@/components/layout/user-avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Ticket } from 'lucide-react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import type { Ticket as TicketType } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tickets',
}

interface SearchParams {
  search?: string
  type?: string
  status?: string
  priority?: string
  assignee?: string
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, type, status, priority, created_at, updated_at,
      requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (params.search) {
    query = query.ilike('title', `%${params.search}%`)
  }
  if (params.type && params.type !== 'all') {
    query = query.eq('type', params.type)
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.priority && params.priority !== 'all') {
    query = query.eq('priority', params.priority)
  }
  if (params.assignee === 'me') {
    query = query.eq('assignee_id', user!.id)
  }

  const { data: tickets } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground text-sm">
            {tickets?.length ?? 0} ticket{tickets?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/tickets/new">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div className="h-10 bg-muted rounded animate-pulse" />}>
        <TicketFilters />
      </Suspense>

      {/* Tickets table */}
      {!tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Ticket className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">
            {params.search || params.type || params.status || params.priority
              ? 'Try adjusting your filters'
              : 'Create the first ticket to get started'}
          </p>
          {!params.search && !params.type && !params.status && !params.priority && (
            <Button asChild size="sm" className="mt-4">
              <Link href="/tickets/new">Create ticket</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-16">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-32">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">Requester</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">Assignee</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-32">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map((ticket) => {
                  const requester = ticket.requester as { display_name?: string; avatar_url?: string } | null
                  const assignee = ticket.assignee as { display_name?: string; avatar_url?: string } | null
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{(ticket as unknown as TicketType).ticket_number}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 max-w-0">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <span className="font-medium truncate block hover:text-primary transition-colors">
                            {ticket.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <TypeBadge type={(ticket as unknown as TicketType).type} />
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <StatusBadge status={(ticket as unknown as TicketType).status} />
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <PriorityBadge priority={(ticket as unknown as TicketType).priority} />
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          {requester ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                displayName={requester.display_name}
                                avatarUrl={requester.avatar_url}
                                size="sm"
                              />
                              <span className="truncate text-xs">{requester.display_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                displayName={assignee.display_name}
                                avatarUrl={assignee.avatar_url}
                                size="sm"
                              />
                              <span className="truncate text-xs">{assignee.display_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unassigned</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(ticket.created_at)}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {tickets.map((ticket) => {
              const requester = ticket.requester as { display_name?: string; avatar_url?: string } | null
              const assignee = ticket.assignee as { display_name?: string; avatar_url?: string } | null
              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="block border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{(ticket as unknown as TicketType).ticket_number}
                      </span>
                      <TypeBadge type={(ticket as unknown as TicketType).type} />
                    </div>
                    <PriorityBadge priority={(ticket as unknown as TicketType).priority} showIcon={false} />
                  </div>
                  <p className="font-medium text-sm mb-3">{ticket.title}</p>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={(ticket as unknown as TicketType).status} />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {requester && (
                        <UserAvatar
                          displayName={requester.display_name}
                          avatarUrl={requester.avatar_url}
                          size="sm"
                        />
                      )}
                      <span>{formatRelativeTime(ticket.created_at)}</span>
                    </div>
                  </div>
                  {assignee && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Assigned to</span>
                      <UserAvatar
                        displayName={assignee.display_name}
                        avatarUrl={assignee.avatar_url}
                        size="sm"
                      />
                      <span>{assignee.display_name}</span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
