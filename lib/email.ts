// Email notification utilities — uses Resend's REST API.
// Requires RESEND_API_KEY and EMAIL_FROM in environment variables.
// If RESEND_API_KEY is not set, all sends are silently skipped.

export type EmailTrigger = 'assigned' | 'status_changed' | 'comment_mention'

export interface TicketEmailContext {
  trigger: EmailTrigger
  to: string               // recipient email
  recipientName: string
  senderName: string
  ticketNumber: number
  ticketId: string
  ticketTitle: string
  ticketType: string
  priority: string
  status: string
  description?: string | null
  appUrl: string            // base URL, e.g. https://yourapp.com
  // For assigned trigger
  assigneeName?: string
  // For status_changed trigger
  newStatus?: string
  // For comment_mention trigger
  commentPreview?: string
}

export async function sendTicketEmail(ctx: TicketEmailContext): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const from = process.env.EMAIL_FROM ?? 'TrackIt <notifications@trackit.app>'
  const { subject, html } = buildEmail(ctx)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [ctx.to], subject, html }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[email] Resend error:', res.status, text)
    }
  } catch (err) {
    console.error('[email] Failed to send:', err)
  }
}

// ─── Subject lines ────────────────────────────────────────────────────────────

function buildEmail(ctx: TicketEmailContext): { subject: string; html: string } {
  const ticketUrl = `${ctx.appUrl}/tickets/${ctx.ticketId}`
  const typeLabel = ctx.ticketType === 'bug' ? '🐛 Bug' : '✨ Feature'
  const priorityLabel = {
    critical: '🚨 Critical',
    high: '🔴 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  }[ctx.priority] ?? ctx.priority
  const statusLabel = {
    todo: 'To Do',
    in_progress: 'In Progress',
    pending: 'Pending',
    in_testing: 'In Testing',
    done: 'Done',
  }[ctx.status] ?? ctx.status

  let subject: string
  let headerLine: string
  let subHeaderLine: string

  if (ctx.trigger === 'assigned') {
    subject = `[TrackIt] You've been assigned to #${ctx.ticketNumber}`
    headerLine = `${ctx.senderName} assigned you to a ticket`
    subHeaderLine = 'You are now responsible for this ticket.'
  } else if (ctx.trigger === 'status_changed') {
    subject = `[TrackIt] Ticket #${ctx.ticketNumber} status updated`
    headerLine = `Status changed to ${ctx.newStatus ?? statusLabel}`
    subHeaderLine = `Updated by ${ctx.senderName}`
  } else {
    subject = `[TrackIt] ${ctx.senderName} mentioned you in #${ctx.ticketNumber}`
    headerLine = `${ctx.senderName} mentioned you in a comment`
    subHeaderLine = ctx.commentPreview ? `"${ctx.commentPreview.slice(0, 120)}…"` : ''
  }

  const descriptionRow = ctx.description
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;width:120px">Description</td><td style="padding:6px 0;font-size:13px;color:#111827">${escHtml(ctx.description.slice(0, 300))}${ctx.description.length > 300 ? '…' : ''}</td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:24px 32px">
          <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px">TrackIt</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827">${escHtml(headerLine)}</h1>
          ${subHeaderLine ? `<p style="margin:0 0 24px;font-size:14px;color:#6b7280">${escHtml(subHeaderLine)}</p>` : '<p style="margin:0 0 24px"></p>'}

          <!-- Ticket card -->
          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px">
            <div style="background:#f9fafb;padding:14px 20px;border-bottom:1px solid #e5e7eb">
              <span style="font-family:monospace;font-size:12px;color:#6b7280;font-weight:600">#${ctx.ticketNumber}</span>
              <span style="margin-left:8px;font-size:12px;color:#6b7280">${typeLabel}</span>
            </div>
            <div style="padding:18px 20px">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827">${escHtml(ctx.ticketTitle)}</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;width:120px">Status</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827">${escHtml(statusLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;width:120px">Priority</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827">${escHtml(priorityLabel)}</td>
                </tr>
                ${descriptionRow}
              </table>
            </div>
          </div>

          <!-- CTA -->
          <a href="${ticketUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
            View Ticket →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            You received this notification from <a href="${ctx.appUrl}" style="color:#6b7280">TrackIt</a>.
            This email was sent because you are involved in this ticket.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
