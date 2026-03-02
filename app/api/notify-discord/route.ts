import { NextRequest, NextResponse } from 'next/server'

const PRIORITY_COLORS: Record<string, number> = {
  critical: 0xED4245,
  high:     0xFF6B35,
  medium:   0xFEE75C,
  low:      0x57F287,
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: '🚨 Critical',
  high:     '🔴 High',
  medium:   '🟡 Medium',
  low:      '🟢 Low',
}

const STATUS_LABELS: Record<string, string> = {
  todo:        '📋 To Do',
  in_progress: '🔄 In Progress',
  pending:     '⏳ Pending',
  in_testing:  '🧪 In Testing',
  done:        '✅ Done',
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Discord webhook not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { action } = body

  // ── CREATE: new forum post with full bug details ──────────────────────────
  if (action === 'create') {
    const {
      ticketId, ticketNumber, title, priority,
      description, stepsToReproduce, expectedBehavior, actualBehavior,
      environmentUrl, attachments = [],
    } = body

    const origin = new URL(request.url).origin
    const ticketUrl = `${origin}/tickets/${ticketId}`
    const threadName = `#${ticketNumber} — ${title}`.slice(0, 100)

    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: 'Priority', value: PRIORITY_LABELS[priority] ?? priority, inline: true },
      { name: 'Status',   value: STATUS_LABELS['todo'],                  inline: true },
    ]

    if (stepsToReproduce) {
      fields.push({ name: 'Steps to Reproduce', value: truncate(stepsToReproduce, 500) })
    }
    if (expectedBehavior || actualBehavior) {
      if (expectedBehavior) fields.push({ name: '✅ Expected',  value: truncate(expectedBehavior, 300), inline: true })
      if (actualBehavior)   fields.push({ name: '❌ Actual',    value: truncate(actualBehavior,   300), inline: true })
    }
    if (environmentUrl) {
      fields.push({ name: 'Environment', value: environmentUrl })
    }

    // First embed: all content + first image (if any)
    const mainEmbed: Record<string, unknown> = {
      title: `🐛 Bug #${ticketNumber}: ${title}`,
      url: ticketUrl,
      color: PRIORITY_COLORS[priority] ?? 0x99AAB5,
      fields,
      footer: { text: 'TrackIt' },
      timestamp: new Date().toISOString(),
    }
    if (description) {
      mainEmbed.description = truncate(description, 350)
    }
    if (attachments.length > 0) {
      mainEmbed.image = { url: attachments[0].url }
    }

    // Additional embeds share the same `url` → Discord renders them as a gallery
    const extraEmbeds = attachments.slice(1, 4).map((a: { url: string }) => ({
      url: ticketUrl,
      image: { url: a.url },
    }))

    // ?wait=true makes Discord return the created message object instead of 204
    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_name: threadName,
        embeds: [mainEmbed, ...extraEmbeds],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'Discord request failed', detail: text }, { status: 502 })
    }

    // id = starter message ID, channel_id = the new forum thread's ID
    const msg = await res.json()
    return NextResponse.json({ ok: true, threadId: msg.channel_id ?? null, messageId: msg.id ?? null })
  }

  // ── COMMENT: post a comment to an existing thread ─────────────────────────
  if (action === 'comment') {
    const { threadId, content, authorName } = body

    const res = await fetch(`${webhookUrl}?thread_id=${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `💬 ${authorName}`,
          description: truncate(content, 4000),
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'Discord request failed', detail: text }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  }

  // ── UPDATE: post an update summary to an existing thread ──────────────────
  if (action === 'update') {
    const { threadId, title, priority, status, assignee, updatedBy } = body

    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: 'Priority', value: PRIORITY_LABELS[priority] ?? priority, inline: true },
      { name: 'Status',   value: STATUS_LABELS[status] ?? status,       inline: true },
    ]
    if (title)    fields.push({ name: 'Title',    value: title })
    fields.push({ name: 'Assignee', value: assignee ?? 'Unassigned' })
    if (updatedBy) fields.push({ name: 'Updated by', value: updatedBy })

    const res = await fetch(`${webhookUrl}?thread_id=${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🔄 Ticket Updated',
          color: 0x99AAB5,
          fields,
          timestamp: new Date().toISOString(),
        }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'Discord request failed', detail: text }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  }

  // ── DELETE: post a deletion notice, then archive + lock the thread ─────────
  if (action === 'delete') {
    const { threadId } = body
    if (!threadId) return NextResponse.json({ ok: true })

    // Post a visible deletion notice inside the thread
    await fetch(`${webhookUrl}?thread_id=${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🗑️ Ticket Deleted',
          description: 'This ticket has been deleted in TrackIt and is no longer active.',
          color: 0xED4245,
          timestamp: new Date().toISOString(),
        }],
      }),
    }).catch(() => {})

    // Archive + lock the thread if a bot token is configured
    const botToken = process.env.DISCORD_BOT_TOKEN
    if (botToken) {
      await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({ archived: true, locked: true }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
