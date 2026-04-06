import { createClient } from '@/lib/supabase/server'
import { TicketsClient, type TicketRow } from '@/components/tickets/tickets-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tickets',
}

export default async function TicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tickets }, { data: profiles }, { data: currentProfile }] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        id, ticket_number, title, type, status, priority, product,
        description, environment_url, steps_to_reproduce, expected_behavior, actual_behavior,
        assignee_id, discord_thread_id, discord_message_id,
        created_at, updated_at,
        requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url),
        assignee:profiles!tickets_assignee_id_fkey(id, display_name, avatar_url)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, created_at, updated_at')
      .order('display_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user!.id)
      .single(),
  ])

  return (
    <TicketsClient
      initialTickets={(tickets ?? []) as unknown as TicketRow[]}
      profiles={profiles ?? []}
      currentUserId={user!.id}
      currentUserName={currentProfile?.display_name ?? null}
    />
  )
}
