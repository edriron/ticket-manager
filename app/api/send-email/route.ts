import { NextRequest, NextResponse } from 'next/server'
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
