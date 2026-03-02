'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { profileSchema, type ProfileFormValues } from '@/lib/validations'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/layout/user-avatar'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

interface SettingsClientProps {
  profile: Profile
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const [saving, setSaving] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      avatar_url: profile.avatar_url ?? '',
    },
  })

  const watchedName = form.watch('display_name')
  const watchedAvatar = form.watch('avatar_url')

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true)

    // Check name uniqueness (exclude own id)
    if (values.display_name !== profile.display_name) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('display_name', values.display_name)
        .neq('id', profile.id)
        .maybeSingle()

      if (existing) {
        form.setError('display_name', {
          message: 'This display name is already taken.',
        })
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: values.display_name,
        avatar_url: values.avatar_url || null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to update profile', { description: error.message })
    } else {
      toast.success('Profile updated!')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile" className="flex-1 sm:flex-none">Profile</TabsTrigger>
          <TabsTrigger value="appearance" className="flex-1 sm:flex-none">Appearance</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Information</CardTitle>
              <CardDescription>
                Update your display name and avatar URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Avatar preview */}
              <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted/50">
                <UserAvatar
                  displayName={watchedName || profile.display_name}
                  avatarUrl={watchedAvatar || profile.avatar_url}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-sm">{watchedName || profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="display_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your display name" {...field} />
                        </FormControl>
                        <FormDescription>
                          This is how others will see you in the app.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avatar_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://example.com/avatar.jpg"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Link to your profile picture. Leave empty to use initials.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input value={profile.email ?? ''} disabled />
                    </FormControl>
                    <FormDescription>
                      Email is managed by Google and cannot be changed here.
                    </FormDescription>
                  </FormItem>

                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>
                Choose how TrackIt looks for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm font-medium">Theme</p>
                <div className="grid grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon
                    const isSelected = theme === option.value

                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:bg-muted/50',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  &quot;System&quot; automatically switches between light and dark based on your OS preference.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
