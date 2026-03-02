import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'
import type { Metadata } from 'next'
import { Bug } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Set Up Your Profile',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, email')
    .eq('id', user.id)
    .single()

  if (profile?.display_name) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
              <Bug className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Almost there!</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Choose a display name so your teammates can find you
              </p>
            </div>
          </div>

          <OnboardingForm userId={user.id} defaultAvatarUrl={profile?.avatar_url ?? null} />
        </div>
      </div>
    </div>
  )
}
