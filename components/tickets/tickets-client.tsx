"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TypeBadge } from "./type-badge";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { TicketForm } from "./ticket-form";
import { TicketViewSheet } from "./ticket-view-sheet";
import { UserAvatar } from "@/components/layout/user-avatar";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Plus,
  ArrowUpDown,
  Ticket,
  ChevronDown,
} from "lucide-react";
import type {
  TicketStatus,
  TicketType as TType,
  TicketPriority,
  TicketProduct,
  Profile,
} from "@/types";
import { TICKET_PRODUCT_LABELS, TICKET_PRODUCT_ICON_PATHS } from "@/types";

// ─── Sort ────────────────────────────────────────────────────────────────────

type SortColumn =
  | "ticket_number"
  | "title"
  | "type"
  | "status"
  | "priority"
  | "updated_at";

const TYPE_ORDER: Record<TType, number> = { bug: 0, feature_request: 1 };
const STATUS_ORDER_MAP: Record<TicketStatus, number> = {
  todo: 0,
  in_progress: 1,
  pending: 2,
  in_testing: 3,
  done: 4,
};
const PRIORITY_ORDER: Record<TicketPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TicketRow {
  id: string;
  ticket_number: number;
  title: string;
  type: TType;
  status: TicketStatus;
  priority: TicketPriority;
  product: TicketProduct;
  created_at: string;
  updated_at: string;
  description: string | null;
  environment_url: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  assignee_id: string | null;
  discord_thread_id: string | null;
  discord_message_id: string | null;
  requester: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  assignee: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface TicketsClientProps {
  initialTickets: TicketRow[];
  profiles: Profile[];
  currentUserId: string;
  currentUserName: string | null;
}

// ─── Filter persistence ───────────────────────────────────────────────────────

const LS_KEY = "trackit-ticket-filters";

function loadFilters() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

// ─── Product icon helper ──────────────────────────────────────────────────────

function ProductIcon({
  product,
  size = 20,
}: {
  product: TicketProduct;
  size?: number;
}) {
  const path = TICKET_PRODUCT_ICON_PATHS[product];
  if (!path) return null;
  return (
    <Image
      src={path}
      alt={TICKET_PRODUCT_LABELS[product]}
      width={size}
      height={size}
      className="rounded-sm shrink-0"
      title={TICKET_PRODUCT_LABELS[product]}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TicketsClient({
  initialTickets,
  profiles,
  currentUserId,
  currentUserName,
}: TicketsClientProps) {
  const router = useRouter();

  // Filter state — defaults first, then hydrated from localStorage in useEffect
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [doneFilter, setDoneFilter] = useState<"active" | "all">("active");
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  // Guard: only save after the initial load from localStorage has been applied.
  // Using state (not ref) so that setFiltersLoaded(true) is batched with the
  // other setStates in the load effect — ensuring the save effect never fires
  // with defaults before the restored values are in state.
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Load filters from localStorage once on mount
  useEffect(() => {
    const saved = loadFilters();
    if (saved.search !== undefined) setSearch(saved.search);
    if (saved.typeFilter) setTypeFilter(saved.typeFilter);
    if (saved.statusFilter) setStatusFilter(saved.statusFilter);
    if (saved.priorityFilter) setPriorityFilter(saved.priorityFilter);
    if (saved.assigneeFilter) setAssigneeFilter(saved.assigneeFilter);
    if (saved.doneFilter) setDoneFilter(saved.doneFilter);
    setFiltersLoaded(true); // batched with the above — save won't fire until this render
  }, []);

  // Save filters to localStorage whenever they change (but not before load)
  useEffect(() => {
    if (!filtersLoaded) return;
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        search,
        typeFilter,
        statusFilter,
        priorityFilter,
        assigneeFilter,
        doneFilter,
      }),
    );
  }, [
    filtersLoaded,
    search,
    typeFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    doneFilter,
  ]);

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);

  // Dialog / sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTicketId, setViewTicketId] = useState<string | null>(null);

  // Assignee options: current user first
  const assigneeOptions = useMemo(() => {
    const current = profiles.find((p) => p.id === currentUserId);
    const others = profiles.filter((p) => p.id !== currentUserId);
    return current ? [current, ...others] : others;
  }, [profiles, currentUserId]);

  const selectedAssigneeProfile = useMemo(
    () => profiles.find((p) => p.id === assigneeFilter) ?? null,
    [profiles, assigneeFilter],
  );

  const currentUserProfile = useMemo(
    () => profiles.find((p) => p.id === currentUserId) ?? null,
    [profiles, currentUserId],
  );

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredTickets = useMemo(() => {
    let result = initialTickets;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (typeFilter !== "all")
      result = result.filter((t) => t.type === typeFilter);
    if (statusFilter !== "all")
      result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all")
      result = result.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter !== "all")
      result = result.filter((t) => t.assignee?.id === assigneeFilter);
    if (doneFilter === "active")
      result = result.filter((t) => t.status !== "done");

    return result;
  }, [
    initialTickets,
    search,
    typeFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    doneFilter,
  ]);

  // ── Sorting ────────────────────────────────────────────────────────────────

  const sortedTickets = useMemo(() => {
    if (!sortColumn) return filteredTickets;
    return [...filteredTickets].sort((a, b) => {
      switch (sortColumn) {
        case "ticket_number":
          return a.ticket_number - b.ticket_number;
        case "title":
          return a.title.localeCompare(b.title);
        case "type": {
          const d = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
          return d !== 0
            ? d
            : new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime();
        }
        case "status": {
          const d = STATUS_ORDER_MAP[a.status] - STATUS_ORDER_MAP[b.status];
          return d !== 0
            ? d
            : new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime();
        }
        case "priority":
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case "updated_at":
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        default:
          return 0;
      }
    });
  }, [filteredTickets, sortColumn]);

  const handleSort = useCallback(
    (col: SortColumn) => setSortColumn((prev) => (prev === col ? null : col)),
    [],
  );

  // ── Clear filters ──────────────────────────────────────────────────────────

  const hasFilters =
    !!search ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    assigneeFilter !== "all" ||
    doneFilter === "all";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setDoneFilter("active");
  }

  // ── Sort header ────────────────────────────────────────────────────────────

  function SortTh({
    column,
    children,
    className,
  }: {
    column: SortColumn;
    children: React.ReactNode;
    className?: string;
  }) {
    const active = sortColumn === column;
    return (
      <th
        className={cn(
          "text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors",
          className,
        )}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown
            className={cn(
              "h-3 w-3 shrink-0",
              active ? "text-primary opacity-100" : "opacity-25",
            )}
          />
        </div>
      </th>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground text-sm">
            {sortedTickets.length} ticket{sortedTickets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Assignee — custom combobox with avatars */}
        <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full sm:w-48 justify-between font-normal text-sm h-9 px-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedAssigneeProfile ? (
                  <>
                    <UserAvatar
                      displayName={selectedAssigneeProfile.display_name}
                      avatarUrl={selectedAssigneeProfile.avatar_url}
                      size="sm"
                    />
                    <span className="truncate">
                      {selectedAssigneeProfile.display_name ??
                        selectedAssigneeProfile.email}
                      {selectedAssigneeProfile.id === currentUserId
                        ? " (Me)"
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">All assignees</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setAssigneeFilter("all");
                      setAssigneePickerOpen(false);
                    }}
                    className="gap-2"
                  >
                    <span className="text-muted-foreground text-sm">
                      All assignees
                    </span>
                    {assigneeFilter === "all" && (
                      <span className="ml-auto text-xs">✓</span>
                    )}
                  </CommandItem>
                  {assigneeOptions.map((profile) => (
                    <CommandItem
                      key={profile.id}
                      value={
                        profile.display_name ?? profile.email ?? profile.id
                      }
                      onSelect={() => {
                        setAssigneeFilter(profile.id);
                        setAssigneePickerOpen(false);
                      }}
                      className="gap-2"
                    >
                      <UserAvatar
                        displayName={profile.display_name}
                        avatarUrl={profile.avatar_url}
                        size="sm"
                      />
                      <span className="truncate text-sm">
                        {profile.display_name ?? profile.email}
                        {profile.id === currentUserId ? " (Me)" : ""}
                      </span>
                      {assigneeFilter === profile.id && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature_request">Feature</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
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

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-36">
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

        <Select
          value={doneFilter}
          onValueChange={(v) => setDoneFilter(v as "active" | "all")}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All tickets</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFilters}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear filters</span>
          </Button>
        )}
      </div>

      {/* Empty state */}
      {sortedTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Ticket className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">
            {hasFilters
              ? "Try adjusting your filters"
              : "Create the first ticket to get started"}
          </p>
          {!hasFilters && (
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              Create ticket
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <SortTh column="ticket_number" className="w-16">
                    #
                  </SortTh>
                  <th className="py-3 px-2 w-9" />
                  <SortTh column="title">Title</SortTh>
                  <SortTh column="type" className="w-32">
                    Type
                  </SortTh>
                  <SortTh column="status" className="w-32">
                    Status
                  </SortTh>
                  <SortTh column="priority" className="w-28">
                    Priority
                  </SortTh>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">
                    Requester
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-36">
                    Assignee
                  </th>
                  <SortTh column="updated_at" className="w-32">
                    Updated
                  </SortTh>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedTickets.map((ticket) => {
                  const requester = ticket.requester;
                  const assignee = ticket.assignee;
                  return (
                    <tr
                      key={ticket.id}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setViewTicketId(ticket.id)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{ticket.ticket_number}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center">
                          <ProductIcon product={ticket.product} size={20} />
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-0">
                        <span className="font-medium truncate block hover:text-primary transition-colors">
                          {ticket.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <TypeBadge type={ticket.type} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="py-3 px-4">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="py-3 px-4">
                        {requester ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              displayName={requester.display_name}
                              avatarUrl={requester.avatar_url}
                              size="sm"
                            />
                            <span className="truncate text-xs">
                              {requester.display_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              displayName={assignee.display_name}
                              avatarUrl={assignee.avatar_url}
                              size="sm"
                            />
                            <span className="truncate text-xs">
                              {assignee.display_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(ticket.updated_at)}
                        </span>
                      </td>
                      <td className="py-3 px-2" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {sortedTickets.map((ticket) => {
              const requester = ticket.requester;
              const assignee = ticket.assignee;
              return (
                <div
                  key={ticket.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setViewTicketId(ticket.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{ticket.ticket_number}
                      </span>
                      <ProductIcon product={ticket.product} size={18} />
                      <TypeBadge type={ticket.type} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <PriorityBadge
                        priority={ticket.priority}
                        showIcon={false}
                      />
                    </div>
                  </div>
                  <p className="font-medium text-sm mb-3">{ticket.title}</p>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={ticket.status} />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {requester && (
                        <UserAvatar
                          displayName={requester.display_name}
                          avatarUrl={requester.avatar_url}
                          size="sm"
                        />
                      )}
                      <span>{formatRelativeTime(ticket.updated_at)}</span>
                    </div>
                  </div>
                  {assignee && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Assigned to</span>
                      <UserAvatar
                        displayName={assignee.display_name}
                        avatarUrl={assignee.avatar_url}
                        size="sm"
                      />
                      <span>{assignee.display_name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* View sheet */}
      <TicketViewSheet
        ticketId={viewTicketId}
        profiles={profiles}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onClose={() => setViewTicketId(null)}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
          </DialogHeader>
          <TicketForm
            mode="create"
            currentUserId={currentUserId}
            currentUserName={currentUserName ?? undefined}
            onSuccess={() => {
              setCreateOpen(false);
              router.refresh();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
