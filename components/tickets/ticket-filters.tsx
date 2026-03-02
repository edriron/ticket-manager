'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

export function TicketFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const type = searchParams.get('type') ?? 'all'
  const status = searchParams.get('status') ?? 'all'
  const priority = searchParams.get('priority') ?? 'all'

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()))
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === 'all' || value === '') {
          current.delete(key)
        } else {
          current.set(key, value)
        }
      })
      return current.toString()
    },
    [searchParams]
  )

  const hasFilters = search || type !== 'all' || status !== 'all' || priority !== 'all'

  function clearFilters() {
    router.push(pathname)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets..."
          className="pl-9"
          defaultValue={search}
          onChange={(e) => {
            const qs = createQueryString({ search: e.target.value || null })
            router.push(`${pathname}?${qs}`)
          }}
        />
      </div>

      <Select
        value={type}
        onValueChange={(value) => {
          const qs = createQueryString({ type: value === 'all' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="bug">Bug</SelectItem>
          <SelectItem value="feature_request">Feature Request</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={status}
        onValueChange={(value) => {
          const qs = createQueryString({ status: value === 'all' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="todo">To Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_testing">In Testing</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={priority}
        onValueChange={(value) => {
          const qs = createQueryString({ priority: value === 'all' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
          <X className="h-4 w-4" />
          <span className="sr-only">Clear filters</span>
        </Button>
      )}
    </div>
  )
}
