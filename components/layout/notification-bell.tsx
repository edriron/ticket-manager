'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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

const PREVIEW_COUNT = 10

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, ticket_id, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT)
    if (data) setNotifications(data as Notification[])
  }, [userId, supabase])

  useEffect(() => {
    fetchNotifications()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => fetchNotifications()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifications, supabase])

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
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchNotifications() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 leading-none font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => {
              const inner = (
                <div
                  className={cn(
                    'px-4 py-3 hover:bg-muted/40 transition-colors',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                        n.read ? 'bg-transparent' : 'bg-primary',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
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
                  onClick={() => { markRead(n.id); setOpen(false) }}
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} onClick={() => markRead(n.id)}>
                  {inner}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
