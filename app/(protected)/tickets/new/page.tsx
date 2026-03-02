import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TicketForm } from '@/components/tickets/ticket-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Ticket',
}

export default async function NewTicketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">New Ticket</h1>
          <p className="text-muted-foreground text-sm">Raise a bug report or feature request</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket Details</CardTitle>
          <CardDescription>
            Fill in the details below. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketForm mode="create" currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  )
}
