import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTicketEmail, type EmailTrigger } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trigger, to, recipientName, senderName, ticketNumber, ticketId, ticketTitle,
            ticketType, priority, status, description, appUrl,
            assigneeName, newStatus, commentPreview } = body as {
      trigger: EmailTrigger
      to: string
      recipientName: string
      senderName: string
      ticketNumber: number
      ticketId: string
      ticketTitle: string
      ticketType: string
      priority: string
      status: string
      description?: string | null
      appUrl?: string
      assigneeName?: string
      newStatus?: string
      commentPreview?: string
    }

    if (!to || !trigger || !ticketId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check recipient's email preferences
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_on_assigned, email_on_new_ticket, email_on_mention')
      .eq('email', to)
      .maybeSingle()

    if (profile) {
      const optedOut =
        (trigger === 'assigned' && profile.email_on_assigned === false) ||
        (trigger === 'new_ticket' && profile.email_on_new_ticket === false) ||
        (trigger === 'comment_mention' && profile.email_on_mention === false)
      if (optedOut) {
        return NextResponse.json({ ok: true, skipped: true })
      }
    }

    const resolvedAppUrl = appUrl ?? new URL(request.url).origin

    await sendTicketEmail({
      trigger,
      to,
      recipientName: recipientName ?? '',
      senderName: senderName ?? 'Someone',
      ticketNumber,
      ticketId,
      ticketTitle,
      ticketType,
      priority,
      status,
      description,
      appUrl: resolvedAppUrl,
      assigneeName,
      newStatus,
      commentPreview,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-email] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
