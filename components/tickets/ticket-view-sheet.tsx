"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EditableMultiline, EditableSingleLine } from "./editable-fields";
import {
  ImageLightbox,
  useLightbox,
  type LightboxImage,
} from "@/components/ui/image-lightbox";
import { TypeBadge } from "./type-badge";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { UserAvatar } from "@/components/layout/user-avatar";
import { CommentSection } from "./comment-section";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeTime, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Pencil,
  Trash2,
  Paperclip,
  Check,
  Upload,
} from "lucide-react";
import type {
  Ticket as TicketType,
  TicketAttachment,
  TicketComment,
  ActivityLog,
  Profile,
  TicketStatus,
  TicketPriority,
  TicketProduct,
} from "@/types";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_ORDER,
  TICKET_PRODUCT_LABELS,
  TICKET_PRODUCT_ICON_PATHS,
} from "@/types";

// ─── Main component ───────────────────────────────────────────────────────────

interface TicketViewSheetProps {
  ticketId: string | null;
  profiles: Profile[];
  currentUserId: string;
  currentUserName: string | null;
  onClose: () => void;
}

export function TicketViewSheet({
  ticketId,
  profiles,
  currentUserId,
  currentUserName,
  onClose,
}: TicketViewSheetProps) {
  const router = useRouter();
  const supabase = createClient();

  const [ticket, setTicket] = useState<TicketType | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sidebar inline-editable state
  const [status, setStatus] = useState<TicketStatus>("todo");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [productValue, setProductValue] = useState<TicketProduct>("other");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeProfile, setAssigneeProfile] = useState<Profile | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Text field state (inline editable)
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState<string | null>(null);
  const [stepsValue, setStepsValue] = useState<string | null>(null);
  const [expectedValue, setExpectedValue] = useState<string | null>(null);
  const [actualValue, setActualValue] = useState<string | null>(null);
  const [envUrlValue, setEnvUrlValue] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Attachments (local state so paste uploads appear immediately)
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [pasteUploading, setPasteUploading] = useState(false);

  // Lightbox
  const lightbox = useLightbox();

  const currentUserProfile =
    profiles.find((p) => p.id === currentUserId) ?? null;

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from("tickets")
        .select(
          "*, attachments:ticket_attachments(*), requester:profiles!tickets_requester_id_fkey(*), assignee:profiles!tickets_assignee_id_fkey(*)",
        )
        .eq("id", ticketId)
        .single(),
      supabase
        .from("ticket_comments")
        .select("*, user:profiles!ticket_comments_user_id_fkey(*)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("*, user:profiles!activity_logs_user_id_fkey(*)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]).then(([{ data: t }, { data: c }, { data: a }]) => {
      if (t) {
        const tk = t as unknown as TicketType;
        setTicket(tk);
        setStatus(tk.status);
        setPriority(tk.priority);
        setProductValue(tk.product ?? "other");
        setAssigneeId(tk.assignee_id);
        setAssigneeProfile(tk.assignee as Profile | null);
        setTitleValue(tk.title);
        setDescriptionValue(tk.description);
        setStepsValue(tk.steps_to_reproduce);
        setExpectedValue(tk.expected_behavior);
        setActualValue(tk.actual_behavior);
        setEnvUrlValue(tk.environment_url);
        setAttachments((tk.attachments as TicketAttachment[]) ?? []);
      }
      setComments((c as TicketComment[]) ?? []);
      setActivityLogs((a as ActivityLog[]) ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // ── DB helpers ─────────────────────────────────────────────────────────────

  async function updateField(
    field: string,
    value: string | null,
    displayValue?: string,
    oldDisplayValue?: string,
  ) {
    if (!ticket) return false;
    setSavingField(field);
    const { error } = await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", ticket.id);
    setSavingField(null);
    if (error) return false;
    supabase
      .from("activity_logs")
      .insert({
        ticket_id: ticket.id,
        user_id: currentUserId,
        action: "updated",
        field,
        old_value: oldDisplayValue ?? null,
        new_value: displayValue ?? value,
      })
      .then();
    router.refresh();
    return true;
  }

  async function saveTextField(
    field: string,
    value: string | null,
    setter: (v: string | null) => void,
  ) {
    const ok = await updateField(field, value);
    if (ok) {
      setter(value);
    } else {
      toast.error(`Failed to save ${field}`);
    }
  }

  async function saveTitleField(value: string | null) {
    if (!value?.trim()) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    const ok = await updateField("title", value.trim());
    setSavingTitle(false);
    if (ok) {
      setTitleValue(value.trim());
      setEditingTitle(false);
    } else {
      toast.error("Failed to save title");
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  function notifyUsers(title: string, body: string, excludeId?: string | null) {
    if (!ticket) return;
    const ids = [ticket.requester_id, excludeId ?? assigneeId].filter(
      (id): id is string => !!id && id !== currentUserId,
    );
    if (ids.length)
      supabase
        .from("notifications")
        .insert(
          ids.map((user_id) => ({
            user_id,
            title,
            body,
            ticket_id: ticket.id,
          })),
        )
        .then();
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
      notifyUsers(
        `Ticket #${ticket!.ticket_number} status changed`,
        `"${titleValue}" → ${TICKET_STATUS_LABELS[newStatus]}`,
      );
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
      notifyUsers(
        `Ticket #${ticket!.ticket_number} priority changed`,
        `"${titleValue}" → ${TICKET_PRIORITY_LABELS[newPriority]}`,
      );
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
    } else {
      setProductValue(prev);
      toast.error("Failed to update product");
    }
  }

  async function handleAssigneeChange(
    newId: string | null,
    newProfile: Profile | null,
  ) {
    const prevId = assigneeId;
    const prevProfile = assigneeProfile;
    setAssigneeId(newId);
    setAssigneeProfile(newProfile);
    const ok = await updateField("assignee_id", newId);
    if (ok) {
      toast.success(newId ? "Assignee updated" : "Assignee removed");
      if (newId && newId !== currentUserId) {
        supabase
          .from("notifications")
          .insert({
            user_id: newId,
            title: `You were assigned to ticket #${ticket!.ticket_number}`,
            body: titleValue,
            ticket_id: ticket!.id,
          })
          .then();
        // Email notification
        if (newProfile?.email) {
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger: "assigned",
              to: newProfile.email,
              recipientName: newProfile.display_name ?? "",
              senderName: currentUserName ?? "Someone",
              ticketNumber: ticket!.ticket_number,
              ticketId: ticket!.id,
              ticketTitle: titleValue,
              ticketType: ticket!.type,
              priority,
              status,
              description: descriptionValue,
            }),
          }).catch(() => {});
        }
      }
      notifyUsers(
        `Ticket #${ticket!.ticket_number} assignee changed`,
        `"${titleValue}" assigned to ${newProfile?.display_name ?? "nobody"}`,
        newId,
      );
    } else {
      setAssigneeId(prevId);
      setAssigneeProfile(prevProfile);
      toast.error("Failed to update assignee");
    }
    setAssigneeOpen(false);
  }

  async function handleDelete() {
    if (!ticket) return;
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
      toast.error("Failed to delete ticket");
      setDeleting(false);
      return;
    }
    toast.success("Ticket deleted");
    onClose();
    router.refresh();
  }

  // ── Paste attachment handler ────────────────────────────────────────────────

  async function handleSheetPaste(e: React.ClipboardEvent) {
    // If user is typing in an input/textarea, let that element handle the paste
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
    if (!ticket) return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();

    setPasteUploading(true);
    const safeName = `paste-${Date.now()}.png`;
    const path = `ticket-${ticket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
    const { error } = await supabase.storage
      .from("ticket-attachments")
      .upload(path, file, { contentType: file.type });
    if (error) {
      toast.error("Failed to upload image");
      setPasteUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("ticket-attachments").getPublicUrl(path);

    const { data: att } = await supabase
      .from("ticket_attachments")
      .insert({
        ticket_id: ticket.id,
        filename: safeName,
        url: publicUrl,
        size: file.size,
        mime_type: file.type,
        uploaded_by: currentUserId,
      })
      .select()
      .single();

    if (att) {
      setAttachments((prev) => [...prev, att as TicketAttachment]);
      toast.success("Image attached to ticket");
    }
    setPasteUploading(false);
  }

  const requester = ticket?.requester as Profile | null;
  const productIconPath = productValue
    ? TICKET_PRODUCT_ICON_PATHS[productValue]
    : null;

  return (
    <>
      <Sheet
        open={!!ticketId}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:w-[90vw] sm:max-w-4xl p-0 flex flex-col overflow-hidden focus:outline-none"
          showCloseButton={false}
          onPaste={handleSheetPaste}
        >
          {/* Visually-hidden title satisfies accessibility requirement */}
          <SheetTitle className="sr-only">
            {titleValue || "Ticket details"}
          </SheetTitle>

          {loading || !ticket ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-8 w-2/3" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-40 w-full mt-4" />
            </div>
          ) : (
            <>
              {/* ── Sticky header ──────────────────────────────────────────── */}
              <SheetHeader className="px-6 py-4 border-b shrink-0 gap-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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

                    {/* Editable title */}
                    {editingTitle ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          autoFocus
                          disabled={savingTitle}
                          className="text-base font-bold h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTitleField(titleDraft);
                            if (e.key === "Escape") setEditingTitle(false);
                          }}
                          onBlur={() => saveTitleField(titleDraft)}
                        />
                      </div>
                    ) : (
                      <div
                        className="group relative cursor-text rounded px-1 -mx-1 hover:bg-muted/40 transition-colors"
                        onClick={() => {
                          setTitleDraft(titleValue);
                          setEditingTitle(true);
                        }}
                      >
                        <h2 className="text-lg font-bold tracking-tight leading-snug pr-5">
                          {titleValue}
                        </h2>
                        <Pencil className="absolute top-1 right-0 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      Opened {formatRelativeTime(ticket.created_at)} by{" "}
                      <span className="font-medium text-foreground">
                        {requester?.display_name ?? "Unknown"}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-1.5"
                    >
                      <Link href={`/tickets/${ticket.id}`} onClick={onClose}>
                        <ExternalLink className="h-3.5 w-3.5" /> Full page
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete ticket #{ticket.ticket_number}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes the ticket, all comments,
                            attachments, and history. Cannot be undone.
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
              </SheetHeader>

              {/* ── Scrollable body ─────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid lg:grid-cols-[1fr_240px] gap-0 min-h-full">
                  {/* Main content */}
                  <div className="p-6 space-y-5 border-r">
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

                    {/* Bug fields */}
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
                              saveTextField(
                                "steps_to_reproduce",
                                v,
                                setStepsValue,
                              )
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
                                saveTextField(
                                  "actual_behavior",
                                  v,
                                  setActualValue,
                                )
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

                    {/* Attachments */}
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Attachments ({attachments.length})
                        {pasteUploading && (
                          <span className="text-xs text-muted-foreground font-normal">
                            Uploading…
                          </span>
                        )}
                      </h3>
                      {attachments.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {attachments.map((a, i) => (
                            <button
                              key={a.id}
                              type="button"
                              className="group relative border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all text-left"
                              onClick={() =>
                                lightbox.openAt(
                                  attachments.map((att) => ({
                                    url: att.url,
                                    filename: att.filename,
                                  })),
                                  i,
                                )
                              }
                            >
                              <div className="aspect-video relative bg-muted">
                                <Image
                                  src={a.url}
                                  alt={a.filename}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width:640px) 50vw, 33vw"
                                />
                              </div>
                              <div className="p-2 bg-background">
                                <p className="text-xs truncate text-muted-foreground">
                                  {a.filename}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground/50 italic flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5" />
                          Paste an image (Ctrl+V) to attach it here
                        </p>
                      )}
                    </div>

                    {/* Comments */}
                    <Separator />
                    {currentUserProfile && (
                      <CommentSection
                        ticketId={ticket.id}
                        ticketNumber={ticket.ticket_number}
                        ticketTitle={titleValue}
                        comments={comments}
                        activityLogs={activityLogs}
                        currentUser={currentUserProfile}
                        profiles={profiles}
                        discordThreadId={ticket.discord_thread_id}
                        ticketType={ticket.type}
                      />
                    )}
                  </div>

                  {/* ── Sidebar ──────────────────────────────────────────────── */}
                  <div className="p-5 space-y-4">
                    {/* Status */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        Status
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button disabled={savingField === "status"}>
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
                          <button disabled={savingField === "priority"}>
                            <PriorityBadge priority={priority} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          {(
                            [
                              "critical",
                              "high",
                              "medium",
                              "low",
                            ] as TicketPriority[]
                          ).map((p) => (
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
                            Object.keys(
                              TICKET_PRODUCT_LABELS,
                            ) as TicketProduct[]
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
                        onOpenChange={setAssigneeOpen}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="flex items-center gap-2 w-full text-left rounded hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors"
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
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name…" />
                            <CommandList>
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() =>
                                    handleAssigneeChange(null, null)
                                  }
                                  className="gap-2 text-muted-foreground"
                                >
                                  <span className="text-sm">Unassigned</span>
                                  {!assigneeId && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                                {profiles
                                  .filter((p) => p.display_name)
                                  .map((u) => (
                                    <CommandItem
                                      key={u.id}
                                      value={u.display_name ?? u.id}
                                      onSelect={() =>
                                        handleAssigneeChange(u.id, u)
                                      }
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
                                          className={cn(
                                            "ml-auto h-4 w-4 shrink-0",
                                          )}
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

                    {/* Dates */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Created
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground cursor-default">
                            {formatRelativeTime(ticket.created_at)}
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
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Updated
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeTime(ticket.updated_at)}
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
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Image lightbox */}
      <ImageLightbox {...lightbox} onClose={lightbox.close} />
    </>
  );
}
