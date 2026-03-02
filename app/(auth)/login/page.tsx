import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          {/* Logo & heading */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M9 9a3 3 0 0 1 5.12-2.13" />
                <path d="M9 9h.01" />
                <path d="M15 13a3 3 0 1 1-5.989.205" />
                <path d="M15 13h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome to TrackIt</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Raise and track bugs &amp; feature requests
              </p>
            </div>
          </div>

          <LoginForm />

          <p className="text-xs text-muted-foreground text-center">
            By signing in, you agree to collaborate respectfully with your team.
          </p>
        </div>
      </div>
    </div>
  )
}
