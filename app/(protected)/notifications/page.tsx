'use client'

import { useState, useEffect, useMemo } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  body: string | null
  ticket_id: string | null
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, ticket_id, read, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setNotifications(data as Notification[])
      setLoading(false)
    }
    fetchAll()
  }, [supabase])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAllRead() {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    if (notifications.find((n) => n.id === id)?.read) return
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm mt-1">You'll be notified about ticket updates here</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {notifications.map((n) => {
            const inner = (
              <div
                className={cn(
                  'px-4 py-4 hover:bg-muted/30 transition-colors',
                  !n.read && 'bg-primary/5',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 rounded-full shrink-0',
                      n.read ? 'bg-muted' : 'bg-primary',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', !n.read && 'font-medium')}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )

            return n.ticket_id ? (
              <Link
                key={n.id}
                href={`/tickets/${n.ticket_id}`}
                className="block"
                onClick={() => markRead(n.id)}
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markRead(n.id)} className="cursor-default">
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
