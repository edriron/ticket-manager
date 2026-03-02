'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { displayNameSchema, type DisplayNameFormValues } from '@/lib/validations'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface OnboardingFormProps {
  userId: string
  defaultAvatarUrl: string | null
}

export function OnboardingForm({ userId, defaultAvatarUrl }: OnboardingFormProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { display_name: '' },
  })

  async function onSubmit(values: DisplayNameFormValues) {
    setLoading(true)

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', values.display_name)
      .neq('id', userId)
      .maybeSingle()

    if (existing) {
      form.setError('display_name', {
        message: 'This display name is already taken. Please choose another.',
      })
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: values.display_name })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to save display name', { description: error.message })
      setLoading(false)
      return
    }

    toast.success('Profile set up! Welcome to TrackIt.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Set your display name</CardTitle>
        <CardDescription>
          This is how you&apos;ll appear to others in the app. You can change it later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Alex Johnson"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    2–50 characters. Letters, numbers, spaces, hyphens and underscores only.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Saving...' : 'Continue to TrackIt'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
