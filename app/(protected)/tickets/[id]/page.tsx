import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { TicketDetailClient } from './ticket-detail-client'
import type { Metadata } from 'next'
import type { Ticket, TicketComment, ActivityLog, Profile } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('tickets')
    .select('title, ticket_number')
    .eq('id', id)
    .single()

  return {
    title: data ? `#${data.ticket_number} ${data.title}` : 'Ticket',
  }
}

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      requester:profiles!tickets_requester_id_fkey(*),
      assignee:profiles!tickets_assignee_id_fkey(*),
      attachments:ticket_attachments(*)
    `)
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const { data: comments } = await supabase
    .from('ticket_comments')
    .select('*, user:profiles!ticket_comments_user_id_fkey(*)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const { data: activityLogs } = await supabase
    .from('activity_logs')
    .select('*, user:profiles!activity_logs_user_id_fkey(*)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const [{ data: currentProfile }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('id, display_name, email, avatar_url, email_on_assigned, email_on_new_ticket, email_on_mention, created_at, updated_at').order('display_name'),
  ])

  return (
    <TicketDetailClient
      ticket={ticket as Ticket}
      comments={(comments as TicketComment[]) ?? []}
      activityLogs={(activityLogs as ActivityLog[]) ?? []}
      currentUser={currentProfile as Profile}
      profiles={(profiles as Profile[]) ?? []}
    />
  )
}
