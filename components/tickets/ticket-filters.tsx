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
  const assignee = searchParams.get('assignee') ?? 'all'
  // 'recent_done' is the default: hide done tickets not updated in last 24h
  const doneFilter = searchParams.get('doneFilter') ?? 'recent_done'

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

  const hasFilters =
    !!search ||
    type !== 'all' ||
    status !== 'all' ||
    priority !== 'all' ||
    assignee === 'me' ||
    doneFilter === 'all' ||
    doneFilter === 'hide_done'

  function clearFilters() {
    router.push(pathname)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
      <div className="relative flex-1 min-w-40">
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

      {/* Assigned to me */}
      <Select
        value={assignee}
        onValueChange={(value) => {
          const qs = createQueryString({ assignee: value === 'all' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Assigned to" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          <SelectItem value="me">Assigned to me</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={type}
        onValueChange={(value) => {
          const qs = createQueryString({ type: value === 'all' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
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
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
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
        <SelectTrigger className="w-full sm:w-37.5">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Done filter — default hides done tickets older than 24h */}
      <Select
        value={doneFilter}
        onValueChange={(value) => {
          const qs = createQueryString({ doneFilter: value === 'recent_done' ? null : value })
          router.push(`${pathname}?${qs}`)
        }}
      >
        <SelectTrigger className="w-full sm:w-45">
          <SelectValue placeholder="Done filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent_done">Active + recent done</SelectItem>
          <SelectItem value="hide_done">Hide all done</SelectItem>
          <SelectItem value="all">Show all</SelectItem>
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
