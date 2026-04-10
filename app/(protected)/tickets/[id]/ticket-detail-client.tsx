"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, ExternalLink, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TypeBadge } from "@/components/tickets/type-badge";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { UserAvatar } from "@/components/layout/user-avatar";
import { CommentSection } from "@/components/tickets/comment-section";
import {
  EditableMultiline,
  EditableSingleLine,
} from "@/components/tickets/editable-fields";
import { ImageLightbox, useLightbox } from "@/components/ui/image-lightbox";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Check } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type {
  Ticket,
  TicketComment,
  ActivityLog,
  Profile,
  TicketStatus,
  TicketPriority,
  TicketProduct,
  TicketWorkflow,
} from "@/types";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_ORDER,
  TICKET_PRODUCT_LABELS,
  TICKET_PRODUCT_ICON_PATHS,
} from "@/types";
import { cn } from "@/lib/utils";
import { WorkflowButton } from "@/components/tickets/workflow-button";

interface TicketDetailClientProps {
  ticket: Ticket;
  comments: TicketComment[];
  activityLogs: ActivityLog[];
  currentUser: Profile;
  profiles: Profile[];
}

export function TicketDetailClient({
  ticket,
  comments,
  activityLogs,
  currentUser,
  profiles,
}: TicketDetailClientProps) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [productValue, setProductValue] = useState<TicketProduct>(
    ticket.product ?? "other",
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(
    ticket.assignee_id,
  );
  const [assigneeProfile, setAssigneeProfile] = useState<Profile | null>(
    ticket.assignee as Profile | null,
  );
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  // Optimistic activity log entries (so new entries show without a page refresh)
  const [pendingLogs, setPendingLogs] = useState<ActivityLog[]>([]);

  // Inline-editable text fields
  const [titleValue, setTitleValue] = useState(ticket.title);
  const [descriptionValue, setDescriptionValue] = useState<string | null>(
    ticket.description,
  );
  const [stepsValue, setStepsValue] = useState<string | null>(
    ticket.steps_to_reproduce,
  );
  const [expectedValue, setExpectedValue] = useState<string | null>(
    ticket.expected_behavior,
  );
  const [actualValue, setActualValue] = useState<string | null>(
    ticket.actual_behavior,
  );
  const [envUrlValue, setEnvUrlValue] = useState<string | null>(
    ticket.environment_url,
  );

  const requester = ticket.requester as Profile | null;
  const supabase = createClient();
  const router = useRouter();
  const lightbox = useLightbox();
  const attachments = ticket.attachments ?? [];

  function notifyUsers(
    title: string,
    body: string,
    excludeForAssigneeId?: string | null,
  ) {
    const targetIds = [
      ticket.requester_id,
      excludeForAssigneeId ?? assigneeId,
    ].filter((id): id is string => !!id && id !== currentUser.id);
    if (!targetIds.length) return;
    supabase
      .from("notifications")
      .insert(
        targetIds.map((user_id) => ({
          user_id,
          title,
          body,
          ticket_id: ticket.id,
        })),
      )
      .then();
  }

  async function updateField(
    field: string,
    value: string | null,
    displayValue?: string,
    oldDisplayValue?: string,
  ) {
    setSavingField(field);
    const { error } = await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", ticket.id);
    setSavingField(null);
    if (error) return false;
    await supabase.from("activity_logs").insert({
      ticket_id: ticket.id,
      user_id: currentUser.id,
      action: "updated",
      field,
      old_value: oldDisplayValue ?? null,
      new_value: displayValue ?? value,
    });
    // Optimistically surface the new entry without waiting for router.refresh()
    setPendingLogs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ticket_id: ticket.id,
        user_id: currentUser.id,
        action: "updated",
        field,
        old_value: oldDisplayValue ?? null,
        new_value: displayValue ?? value,
        created_at: new Date().toISOString(),
        user: currentUser,
      },
    ]);
    return true;
  }

  // ── Apply workflow ──────────────────────────────────────────────────────────

  async function applyWorkflow(workflow: TicketWorkflow) {
    const loadingId = toast.loading(`Applying "${workflow.name}"…`);
    // React state updates (setStatus etc.) don't update the closure variable
    // until the next render, so track latest values locally and pass them
    // explicitly to handlers that embed them in notifications/emails.
    let latestStatus = status;
    let latestPriority = priority;
    for (const step of workflow.steps) {
      if (step.type === "status" && step.value) {
        await handleStatusChange(step.value as TicketStatus);
        latestStatus = step.value as TicketStatus;
      } else if (step.type === "priority" && step.value) {
        await handlePriorityChange(step.value as TicketPriority);
        latestPriority = step.value as TicketPriority;
      } else if (step.type === "assignee") {
        const newProfile = step.value
          ? (profiles.find((p) => p.id === step.value) ?? null)
          : null;
        await handleAssigneeChange(step.value, newProfile, latestStatus, latestPriority);
      } else if (step.type === "comment" && step.value?.trim()) {
        await supabase.from("ticket_comments").insert({
          ticket_id: ticket.id,
          user_id: currentUser.id,
          content: step.value.trim(),
        });
      }
    }
    toast.dismiss(loadingId);
    toast.success(`"${workflow.name}" applied`);
    router.refresh();
  }

  async function saveTextField(
    field: string,
    value: string | null,
    setter: (v: string | null) => void,
  ) {
    const ok = await updateField(field, value);
    if (ok) {
      setter(value);
      router.refresh();
    } else {
      toast.error(`Failed to save ${field}`);
    }
  }

  async function saveTitleField(value: string | null) {
    if (!value?.trim()) return;
    const ok = await updateField("title", value.trim());
    if (ok) {
      setTitleValue(value.trim());
      router.refresh();
    } else {
      toast.error("Failed to save title");
    }
  }

  function notifyDiscordUpdate(
    newStatus: TicketStatus,
    newPriority: TicketPriority,
    newAssigneeName: string | null | undefined,
  ) {
    if (!ticket.discord_thread_id) return;
    fetch("/api/notify-discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        ticketType: ticket.type,
        threadId: ticket.discord_thread_id,
        title: titleValue,
        priority: newPriority,
        status: newStatus,
        assignee: newAssigneeName ?? null,
        updatedBy: currentUser.display_name,
      }),
    }).catch(() => {});
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    const prev = status;
    setStatus(newStatus);
    const ok = await updateField(
      "status",
      newStatus,
      TICKET_STATUS_LABELS[newStatus],
      TICKET_STATUS_LABELS[prev],
    );
    if (ok) {
      toast.success(`Status → ${TICKET_STATUS_LABELS[newStatus]}`);
      notifyDiscordUpdate(newStatus, priority, assigneeProfile?.display_name);
      notifyUsers(
        `Ticket #${ticket.ticket_number} status changed`,
        `"${titleValue}" → ${TICKET_STATUS_LABELS[newStatus]}`,
      );
      router.refresh();
    } else {
      setStatus(prev);
      toast.error("Failed to update status");
    }
  }

  async function handlePriorityChange(newPriority: TicketPriority) {
    const prev = priority;
    setPriority(newPriority);
    const ok = await updateField(
      "priority",
      newPriority,
      TICKET_PRIORITY_LABELS[newPriority],
      TICKET_PRIORITY_LABELS[prev],
    );
    if (ok) {
      toast.success(`Priority → ${TICKET_PRIORITY_LABELS[newPriority]}`);
      notifyDiscordUpdate(status, newPriority, assigneeProfile?.display_name);
      notifyUsers(
        `Ticket #${ticket.ticket_number} priority changed`,
        `"${titleValue}" → ${TICKET_PRIORITY_LABELS[newPriority]}`,
      );
      router.refresh();
    } else {
      setPriority(prev);
      toast.error("Failed to update priority");
    }
  }

  async function handleProductChange(newProduct: TicketProduct) {
    const prev = productValue;
    setProductValue(newProduct);
    const ok = await updateField(
      "product",
      newProduct,
      TICKET_PRODUCT_LABELS[newProduct],
    );
    if (ok) {
      toast.success(`Product → ${TICKET_PRODUCT_LABELS[newProduct]}`);
      router.refresh();
    } else {
      setProductValue(prev);
      toast.error("Failed to update product");
    }
  }

  async function handleAssigneeChange(
    newAssigneeId: string | null,
    preloadedProfile?: Profile | null,
    statusOverride?: TicketStatus,
    priorityOverride?: TicketPriority,
  ) {
    const prevId = assigneeId;
    const prevProfile = assigneeProfile;
    const optimisticProfile =
      preloadedProfile !== undefined
        ? preloadedProfile
        : newAssigneeId
          ? (userResults.find((u) => u.id === newAssigneeId) ?? null)
          : null;
    setAssigneeId(newAssigneeId);
    setAssigneeProfile(optimisticProfile);

    const ok = await updateField("assignee_id", newAssigneeId);
    if (ok) {
      toast.success(newAssigneeId ? "Assignee updated" : "Assignee removed");
      notifyDiscordUpdate(
        statusOverride ?? status,
        priorityOverride ?? priority,
        optimisticProfile?.display_name ?? null,
      );
      if (newAssigneeId && newAssigneeId !== currentUser.id) {
        supabase
          .from("notifications")
          .insert({
            user_id: newAssigneeId,
            title: `You were assigned to ticket #${ticket.ticket_number}`,
            body: titleValue,
            ticket_id: ticket.id,
          })
          .then();
        if (optimisticProfile?.email) {
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger: "assigned",
              to: optimisticProfile.email,
              recipientName: optimisticProfile.display_name ?? "",
              senderName: currentUser.display_name ?? "Someone",
              ticketNumber: ticket.ticket_number,
              ticketId: ticket.id,
              ticketTitle: titleValue,
              ticketType: ticket.type,
              priority: priorityOverride ?? priority,
              status: statusOverride ?? status,
              description: descriptionValue,
            }),
          }).catch(() => {});
        }
      }
      notifyUsers(
        `Ticket #${ticket.ticket_number} assignee changed`,
        `"${titleValue}" assigned to ${optimisticProfile?.display_name ?? "nobody"}`,
        newAssigneeId,
      );
      router.refresh();
    } else {
      setAssigneeId(prevId);
      setAssigneeProfile(prevProfile);
      toast.error("Failed to update assignee");
    }
  }

  async function searchUsers(query: string) {
    const q = supabase
      .from("profiles")
      .select("*")
      .not("display_name", "is", null)
      .limit(10);
    if (query) q.or(`display_name.ilike.%${query}%,email.ilike.%${query}%`);
    const { data } = await q;
    setUserResults((data as Profile[]) ?? []);
  }

  async function handleDelete() {
    setDeleting(true);
    if (ticket.discord_thread_id) {
      fetch("/api/notify-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          ticketType: ticket.type,
          threadId: ticket.discord_thread_id,
        }),
      }).catch(() => {});
    }
    const { error } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticket.id);
    if (error) {
      toast.error("Failed to delete ticket", { description: error.message });
      setDeleting(false);
      return;
    }
    toast.success("Ticket deleted");
    router.push("/tickets");
    router.refresh();
  }

  const priorities: TicketPriority[] = ["critical", "high", "medium", "low"];
  const productIconPath = TICKET_PRODUCT_ICON_PATHS[productValue];

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 mt-0.5 shrink-0"
          >
            <Link href="/tickets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground font-medium">
                #{ticket.ticket_number}
              </span>
              {productIconPath && (
                <Image
                  src={productIconPath}
                  alt={TICKET_PRODUCT_LABELS[productValue]}
                  width={18}
                  height={18}
                  className="rounded-sm"
                />
              )}
              <TypeBadge type={ticket.type} />
              <StatusBadge status={status} />
              <PriorityBadge priority={priority} />
            </div>
            {/* Inline-editable title */}
            <EditableSingleLine
              value={titleValue}
              onSave={saveTitleField}
              placeholder="Click to edit title…"
              className="text-xl font-bold tracking-tight -ml-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Opened{" "}
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  {formatRelativeTime(ticket.created_at)}
                </TooltipTrigger>
                <TooltipContent>
                  {formatDateTime(ticket.created_at)}
                </TooltipContent>
              </Tooltip>{" "}
              by{" "}
              <span className="font-medium text-foreground">
                {requester?.display_name ?? "Unknown"}
              </span>
              {ticket.updated_at !== ticket.created_at && (
                <>
                  {" "}
                  · Updated{" "}
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      {formatRelativeTime(ticket.updated_at)}
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatDateTime(ticket.updated_at)}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <WorkflowButton
              userId={currentUser.id}
              onApply={applyWorkflow}
              disabled={!!savingField}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete ticket #{ticket.ticket_number}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the ticket, all its comments,
                    attachments, and activity history. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete ticket
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="space-y-4 min-w-0">
            <Card>
              <CardContent className="pt-6 space-y-5">
                {/* Description */}
                <EditableMultiline
                  label="Description"
                  value={descriptionValue}
                  placeholder="Click to add a description…"
                  rows={4}
                  onSave={(v) =>
                    saveTextField("description", v, setDescriptionValue)
                  }
                />

                {ticket.type === "bug" && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Bug Details
                      </p>
                      <EditableMultiline
                        label="Steps to Reproduce"
                        value={stepsValue}
                        placeholder="Click to add steps…"
                        rows={4}
                        onSave={(v) =>
                          saveTextField("steps_to_reproduce", v, setStepsValue)
                        }
                      />
                      <div className="grid sm:grid-cols-2 gap-4">
                        <EditableMultiline
                          label="Expected Behavior"
                          value={expectedValue}
                          placeholder="Click to add…"
                          rows={3}
                          labelClassName="text-green-600 dark:text-green-400"
                          onSave={(v) =>
                            saveTextField(
                              "expected_behavior",
                              v,
                              setExpectedValue,
                            )
                          }
                        />
                        <EditableMultiline
                          label="Actual Behavior"
                          value={actualValue}
                          placeholder="Click to add…"
                          rows={3}
                          labelClassName="text-red-600 dark:text-red-400"
                          onSave={(v) =>
                            saveTextField("actual_behavior", v, setActualValue)
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Environment URL */}
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-1.5">
                    Environment URL
                  </h3>
                  <EditableSingleLine
                    value={envUrlValue}
                    inputType="url"
                    placeholder="Click to add URL…"
                    onSave={(v) =>
                      saveTextField("environment_url", v, setEnvUrlValue)
                    }
                  />
                  {envUrlValue && (
                    <a
                      href={envUrlValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {attachments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Attachments ({attachments.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {attachments.map((attachment, i) => (
                          <button
                            key={attachment.id}
                            type="button"
                            className="group relative border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all text-left"
                            onClick={() =>
                              lightbox.openAt(
                                attachments.map((a) => ({
                                  url: a.url,
                                  filename: a.filename,
                                })),
                                i,
                              )
                            }
                          >
                            <div className="aspect-video relative bg-muted">
                              <Image
                                src={attachment.url}
                                alt={attachment.filename}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                            </div>
                            <div className="p-2 bg-background">
                              <p className="text-xs truncate text-muted-foreground">
                                {attachment.filename}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <CommentSection
                  ticketId={ticket.id}
                  ticketNumber={ticket.ticket_number}
                  ticketTitle={titleValue}
                  comments={comments}
                  activityLogs={[...activityLogs, ...pendingLogs]}
                  currentUser={currentUser}
                  profiles={profiles}
                  discordThreadId={ticket.discord_thread_id}
                  ticketType={ticket.type}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  {/* Status */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Status
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1.5"
                          disabled={savingField === "status"}
                        >
                          <StatusBadge status={status} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {TICKET_STATUS_ORDER.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onSelect={() => handleStatusChange(s)}
                            className="gap-2"
                          >
                            <StatusBadge status={s} />
                            {s === status && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                ✓
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Separator />

                  {/* Priority */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Priority
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1.5"
                          disabled={savingField === "priority"}
                        >
                          <PriorityBadge priority={priority} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        {priorities.map((p) => (
                          <DropdownMenuItem
                            key={p}
                            onSelect={() => handlePriorityChange(p)}
                            className="gap-2"
                          >
                            <PriorityBadge priority={p} />
                            {p === priority && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                ✓
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Separator />

                  {/* Product */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Product
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-2 rounded hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors"
                          disabled={savingField === "product"}
                        >
                          {TICKET_PRODUCT_ICON_PATHS[productValue] && (
                            <Image
                              src={TICKET_PRODUCT_ICON_PATHS[productValue]!}
                              alt=""
                              width={16}
                              height={16}
                              className="rounded-sm"
                            />
                          )}
                          <span className="text-sm">
                            {TICKET_PRODUCT_LABELS[productValue]}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        {(
                          Object.keys(TICKET_PRODUCT_LABELS) as TicketProduct[]
                        ).map((p) => (
                          <DropdownMenuItem
                            key={p}
                            onSelect={() => handleProductChange(p)}
                            className="gap-2"
                          >
                            {TICKET_PRODUCT_ICON_PATHS[p] && (
                              <Image
                                src={TICKET_PRODUCT_ICON_PATHS[p]!}
                                alt=""
                                width={16}
                                height={16}
                                className="rounded-sm"
                              />
                            )}
                            <span>{TICKET_PRODUCT_LABELS[p]}</span>
                            {p === productValue && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                ✓
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Separator />

                  {/* Requester */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Requester
                    </p>
                    {requester ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          displayName={requester.display_name}
                          avatarUrl={requester.avatar_url}
                          size="sm"
                        />
                        <span className="text-sm">
                          {requester.display_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unknown
                      </span>
                    )}
                  </div>

                  <Separator />

                  {/* Assignee */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Assignee
                    </p>
                    <Popover
                      open={assigneeOpen}
                      onOpenChange={(o) => {
                        setAssigneeOpen(o);
                        if (o) searchUsers("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="flex items-center gap-2 w-full text-left group rounded hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors"
                          disabled={savingField === "assignee_id"}
                        >
                          {assigneeProfile ? (
                            <>
                              <UserAvatar
                                displayName={assigneeProfile.display_name}
                                avatarUrl={assigneeProfile.avatar_url}
                                size="sm"
                              />
                              <span className="text-sm">
                                {assigneeProfile.display_name}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Unassigned
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name or email..."
                            onValueChange={searchUsers}
                          />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  handleAssigneeChange(null);
                                  setAssigneeOpen(false);
                                }}
                                className="gap-2 text-muted-foreground"
                              >
                                <span className="text-sm">Unassigned</span>
                                {!assigneeId && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                              {userResults.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.id}
                                  onSelect={() => {
                                    handleAssigneeChange(u.id);
                                    setAssigneeOpen(false);
                                  }}
                                  className="gap-2"
                                >
                                  <UserAvatar
                                    displayName={u.display_name}
                                    avatarUrl={u.avatar_url}
                                    size="sm"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium">
                                      {u.display_name}
                                    </span>
                                    {u.email && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {u.email}
                                      </span>
                                    )}
                                  </div>
                                  {assigneeId === u.id && (
                                    <Check
                                      className={cn("ml-auto h-4 w-4 shrink-0")}
                                    />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Separator />

                  {/* Created */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Created
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground cursor-default">
                          {formatDate(ticket.created_at)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateTime(ticket.created_at)}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {ticket.updated_at !== ticket.created_at && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                          Last Updated
                        </p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground cursor-default">
                              {formatDate(ticket.updated_at)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatDateTime(ticket.updated_at)}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      <ImageLightbox {...lightbox} onClose={lightbox.close} />
    </>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
