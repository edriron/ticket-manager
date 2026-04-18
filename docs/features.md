# TrackIt — Feature Documentation

## 1. Email Notifications

### Triggers

| Trigger | When | Email preference key |
|---|---|---|
| `new_ticket` | Ticket created with an assignee (assignee ≠ creator) | `email_on_new_ticket` |
| `assigned` | Assignee changed on an existing ticket | `email_on_assigned` |
| `comment_mention` | User @mentioned in a comment | `email_on_mention` |

### How it works
- Emails are sent via **Resend** (`RESEND_API_KEY` env var required).
- The POST `/api/send-email` route checks the recipient's email preferences in `profiles` before sending. If the user has opted out of that trigger, the call returns `{ ok: true, skipped: true }` without sending.
- HTML descriptions are stripped of tags before inclusion in email previews.

### In-app notifications
In-app notifications are always sent regardless of email preferences:
- **Ticket creation** → assignee gets notified (implemented in `ticket-form.tsx`)
- **Assignee change** → new assignee gets notified (implemented in `ticket-detail-client.tsx`)
- **@mention in comment** → mentioned user gets notified (implemented in `comment-section.tsx`)

---

## 2. Email Preferences (Settings → Notifications)

Three per-user boolean columns were added to the `profiles` table:

```sql
-- Run this migration on existing databases:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_assigned   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_new_ticket  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_on_mention     BOOLEAN NOT NULL DEFAULT TRUE;
```

UI: **Settings → Notifications** tab — three labelled checkboxes with a Save button.  
Component: `app/(protected)/settings/settings-client.tsx`

---

## 3. Rich Text Editor

Powered by **TipTap** (`@tiptap/react` + extensions). Installed packages:

```
@tiptap/react  @tiptap/pm  @tiptap/starter-kit
@tiptap/extension-underline  @tiptap/extension-color
@tiptap/extension-text-style  @tiptap/extension-highlight
@tiptap/extension-placeholder  @tiptap/extension-mention
@tiptap/suggestion
```

### Components

| Component | File | Used for |
|---|---|---|
| `RichTextEditor` | `components/ui/rich-text-editor.tsx` | Ticket description (create/edit form) |
| `RichTextContent` | `components/ui/rich-text-editor.tsx` | Rendering stored HTML |
| `EditableRichText` | `components/tickets/editable-fields.tsx` | Inline-edit description in ticket detail |
| `CommentEditor` | `components/tickets/comment-editor.tsx` | Comment input with rich text + @mentions |
| `CommentContent` | `components/tickets/comment-editor.tsx` | Rendering stored comment HTML |

### Supported formats
- **Headers** H1–H6 (toolbar buttons)
- **Divider** (horizontal rule)
- **Bold / Italic / Underline / Strikethrough**
- **Bullet list / Ordered list** (auto tab-dots/numbers)
- **Blockquote**
- **Font color** (12 swatches + clear)
- **Background/highlight color** (8 swatches + clear)

### Storage format
Content is stored as HTML strings in the existing `TEXT` columns (`tickets.description`, `ticket_comments.content`). Backward-compatible: if stored content does not start with `<`, it is rendered as plain text (legacy data).

### @mentions in comments
`CommentEditor` integrates TipTap's Mention extension. Mentions are rendered as `<span class="mention">@Name</span>` in the stored HTML. The `extractMentionIds(doc)` helper in `comment-editor.tsx` walks the TipTap JSON to collect mentioned user IDs for notifications.

---

## 4. Dashboard — New Ticket shortcut

The **New Ticket** button in the dashboard header now links directly to `/tickets/new`, bypassing the ticket list page.

File: `app/(protected)/dashboard/page.tsx`
