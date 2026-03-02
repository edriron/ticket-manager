import { createClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/dashboard/stats-card'
import { TypeBadge } from '@/components/tickets/type-badge'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ticket, Bug, Sparkles, CheckCircle2, ClockIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { UserAvatar } from '@/components/layout/user-avatar'
import type { Metadata } from 'next'
import type { Ticket as TicketType } from '@/types'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats
  const [
    { count: totalCount },
    { count: openCount },
    { count: inTestingCount },
    { count: doneCount },
    { count: bugCount },
    { count: featureCount },
  ] = await Promise.all([
    supabase.from('tickets').select('*', { count: 'exact', head: true }),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['todo', 'in_progress', 'pending']),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_testing'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('type', 'bug'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('type', 'feature_request'),
  ])

  // My open tickets (assigned to me)
  const { data: myTickets } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, type, status, priority, created_at,
      requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url)
    `)
    .eq('assignee_id', user!.id)
    .neq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent tickets
  const { data: recentTickets } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, type, status, priority, created_at,
      requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of all tickets</p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/tickets/new">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatsCard
          title="Total Tickets"
          value={totalCount ?? 0}
          description="All time"
          icon={Ticket}
          iconClassName="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        />
        <StatsCard
          title="Open"
          value={openCount ?? 0}
          description="To do, in progress, pending"
          icon={ClockIcon}
          iconClassName="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
        />
        <StatsCard
          title="In Testing"
          value={inTestingCount ?? 0}
          description="Ready for QA"
          icon={Sparkles}
          iconClassName="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
        />
        <StatsCard
          title="Done"
          value={doneCount ?? 0}
          description="Resolved"
          icon={CheckCircle2}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300"
        />
      </div>

      {/* Type breakdown */}
      <div className="grid gap-4 grid-cols-2">
        <StatsCard
          title="Bugs"
          value={bugCount ?? 0}
          icon={Bug}
          iconClassName="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
        />
        <StatsCard
          title="Feature Requests"
          value={featureCount ?? 0}
          icon={Sparkles}
          iconClassName="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My open tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned to Me</CardTitle>
            <CardDescription>Your open tickets</CardDescription>
          </CardHeader>
          <CardContent>
            {myTickets && myTickets.length > 0 ? (
              <div className="space-y-3">
                {myTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{ticket.ticket_number}
                        </span>
                        <TypeBadge type={(ticket as unknown as TicketType).type} showIcon={false} />
                      </div>
                      <p className="text-sm font-medium truncate">{ticket.title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={(ticket as unknown as TicketType).status} />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/tickets?assignee=me">View all</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tickets assigned to you</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest tickets raised</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTickets && recentTickets.length > 0 ? (
              <div className="space-y-3">
                {recentTickets.map((ticket) => {
                  const requester = ticket.requester as { display_name?: string; avatar_url?: string } | null
                  return (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <UserAvatar
                        displayName={requester?.display_name}
                        avatarUrl={requester?.avatar_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{ticket.ticket_number}
                          </span>
                          <TypeBadge type={(ticket as unknown as TicketType).type} showIcon={false} />
                        </div>
                        <p className="text-sm truncate">{ticket.title}</p>
                      </div>
                      <div className="shrink-0">
                        <PriorityBadge priority={(ticket as unknown as TicketType).priority} showIcon={false} />
                      </div>
                    </Link>
                  )
                })}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/tickets">View all tickets</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tickets yet</p>
                <Button variant="outline" size="sm" asChild className="mt-3">
                  <Link href="/tickets/new">Create first ticket</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
