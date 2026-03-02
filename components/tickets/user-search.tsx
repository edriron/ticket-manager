'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { UserAvatar } from '@/components/layout/user-avatar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

interface UserSearchProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

export function UserSearch({ value, onChange, placeholder = 'Search users...', disabled }: UserSearchProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const supabase = createClient()

  // Load selected user info
  useEffect(() => {
    if (value) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', value)
        .single()
        .then(({ data }) => {
          if (data) setSelectedUser(data as Profile)
        })
    } else {
      setSelectedUser(null)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  async function searchUsers(search: string) {
    setLoading(true)
    const query = supabase
      .from('profiles')
      .select('*')
      .not('display_name', 'is', null)
      .limit(10)

    if (search) {
      query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data } = await query
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }

  function handleSelect(user: Profile) {
    onChange(user.id)
    setSelectedUser(user)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setSelectedUser(null)
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) searchUsers('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between h-10 font-normal',
            !selectedUser && 'text-muted-foreground'
          )}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar
                displayName={selectedUser.display_name}
                avatarUrl={selectedUser.avatar_url}
                size="sm"
              />
              <span className="truncate text-sm">{selectedUser.display_name}</span>
            </div>
          ) : (
            <span className="text-sm">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selectedUser && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                className="p-0.5 rounded hover:bg-muted cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or email..."
            onValueChange={(search) => searchUsers(search)}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => handleSelect(user)}
                      className="gap-2"
                    >
                      <UserAvatar
                        displayName={user.display_name}
                        avatarUrl={user.avatar_url}
                        size="sm"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium">{user.display_name}</span>
                        {user.email && (
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0',
                          value === user.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
