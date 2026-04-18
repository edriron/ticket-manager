"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ticketSchema, type TicketFormValues } from "@/lib/validations";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UserSearch } from "./user-search";
import { AttachmentUploader, type UploadedFile } from "./attachment-uploader";
import type { Ticket, TicketAttachment } from "@/types";
import { TICKET_PRODUCT_LABELS, TICKET_PRODUCT_ICON_PATHS } from "@/types";

const PRODUCTS = [
  "vetra",
  "gym_pocket",
  "trackit",
  "aqua",
  "lumos",
  "other",
] as const;

interface TicketFormProps {
  mode: "create" | "edit";
  ticket?: Ticket;
  currentUserId: string;
  currentUserName?: string;
  onCancel?: () => void;
  /** Called after successful submit. If omitted in create mode, navigates to the new ticket page. */
  onSuccess?: (ticketId: string) => void;
}

export function TicketForm({
  mode,
  ticket,
  currentUserId,
  currentUserName,
  onCancel,
  onSuccess,
}: TicketFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>(
    ticket?.attachments?.map((a: TicketAttachment) => ({
      id: a.id,
      filename: a.filename,
      url: a.url,
      size: a.size ?? 0,
      mime_type: a.mime_type ?? "image/png",
    })) ?? [],
  );

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: ticket?.title ?? "",
      type: ticket?.type ?? undefined,
      status: ticket?.status ?? "todo",
      priority: ticket?.priority ?? "medium",
      product: ticket?.product ?? "other",
      description: ticket?.description ?? "",
      environment_url: ticket?.environment_url ?? "",
      assignee_id: ticket?.assignee_id ?? "",
      steps_to_reproduce: ticket?.steps_to_reproduce ?? "",
      expected_behavior: ticket?.expected_behavior ?? "",
      actual_behavior: ticket?.actual_behavior ?? "",
    },
  });

  const watchType = form.watch("type");
  const isBug = watchType === "bug";

  async function onSubmit(values: TicketFormValues) {
    setLoading(true);

    const payload = {
      title: values.title,
      type: values.type,
      status: values.status,
      priority: values.priority,
      product: values.product,
      description: values.description || null,
      environment_url: values.environment_url || null,
      assignee_id: values.assignee_id || null,
      steps_to_reproduce: isBug ? values.steps_to_reproduce || null : null,
      expected_behavior: isBug ? values.expected_behavior || null : null,
      actual_behavior: isBug ? values.actual_behavior || null : null,
    };

    if (mode === "create") {
      const { data: newTicket, error } = await supabase
        .from("tickets")
        .insert({ ...payload, requester_id: currentUserId })
        .select("id, ticket_number")
        .single();

      if (error) {
        toast.error("Failed to create ticket", { description: error.message });
        setLoading(false);
        return;
      }

      // Save attachments
      if (attachments.length > 0) {
        const attachmentRows = attachments.map((a) => ({
          ticket_id: newTicket.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
          mime_type: a.mime_type,
          uploaded_by: currentUserId,
        }));
        await supabase.from("ticket_attachments").insert(attachmentRows);
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        ticket_id: newTicket.id,
        user_id: currentUserId,
        action: "created",
      });

      // Notify assignee (if set and not self)
      if (values.assignee_id && values.assignee_id !== currentUserId) {
        supabase
          .from("notifications")
          .insert({
            user_id: values.assignee_id,
            title: `You were assigned to new ticket #${(newTicket as { id: string; ticket_number: number }).ticket_number}`,
            body: values.title,
            ticket_id: newTicket.id,
          })
          .then();

        const { data: assigneeProfile } = await supabase
          .from("profiles")
          .select("email, display_name")
          .eq("id", values.assignee_id)
          .maybeSingle();

        if (assigneeProfile?.email) {
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger: "new_ticket",
              to: assigneeProfile.email,
              recipientName: assigneeProfile.display_name ?? "",
              senderName: currentUserName ?? "Someone",
              ticketNumber: (newTicket as { id: string; ticket_number: number }).ticket_number,
              ticketId: newTicket.id,
              ticketTitle: values.title,
              ticketType: values.type,
              priority: values.priority,
              status: values.status,
              description: values.description || null,
            }),
          }).catch(() => {});
        }
      }

      // Notify Discord
      try {
        const res = await fetch("/api/notify-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            ticketType: values.type,
            ticketId: newTicket.id,
            ticketNumber: (newTicket as { id: string; ticket_number: number })
              .ticket_number,
            title: values.title,
            priority: values.priority,
            description: values.description || null,
            stepsToReproduce: values.steps_to_reproduce || null,
            expectedBehavior: values.expected_behavior || null,
            actualBehavior: values.actual_behavior || null,
            environmentUrl: values.environment_url || null,
            attachments: attachments.map((a) => ({
              filename: a.filename,
              url: a.url,
            })),
          }),
        });
        if (res.ok) {
          const { threadId, messageId } = await res.json();
          if (threadId) {
            await supabase
              .from("tickets")
              .update({
                discord_thread_id: threadId,
                discord_message_id: messageId ?? null,
              })
              .eq("id", newTicket.id);
          }
        }
      } catch {
        // Discord failure must not block the UI
      }

      toast.success("Ticket created!");
      if (onSuccess) {
        onSuccess(newTicket.id);
      } else {
        router.push(`/tickets/${newTicket.id}`);
        router.refresh();
      }
    } else if (mode === "edit" && ticket) {
      const { error } = await supabase
        .from("tickets")
        .update(payload)
        .eq("id", ticket.id);

      if (error) {
        toast.error("Failed to update ticket", { description: error.message });
        setLoading(false);
        return;
      }

      // Handle new attachments
      const newAttachments = attachments.filter((a) => !a.id);
      if (newAttachments.length > 0) {
        const attachmentRows = newAttachments.map((a) => ({
          ticket_id: ticket.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
          mime_type: a.mime_type,
          uploaded_by: currentUserId,
        }));
        await supabase.from("ticket_attachments").insert(attachmentRows);
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        ticket_id: ticket.id,
        user_id: currentUserId,
        action: "updated",
      });

      // Notify Discord thread
      if (ticket.discord_thread_id) {
        fetch("/api/notify-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            ticketType: ticket.type,
            threadId: ticket.discord_thread_id,
            title: values.title,
            priority: values.priority,
            status: values.status,
            updatedBy: currentUserName,
          }),
        }).catch(() => {});
      }

      toast.success("Ticket updated!");
      if (onSuccess) {
        onSuccess(ticket.id);
      } else {
        router.refresh();
        onCancel?.();
      }
    }

    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Title <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Brief summary of the issue or request"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type + Priority + Product row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Type <span className="text-destructive">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="bug">🐛 Bug</SelectItem>
                    <SelectItem value="feature_request">
                      ✨ Feature Request
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="critical">🚨 Critical</SelectItem>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="product"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRODUCTS.map((p) => {
                      const iconPath = TICKET_PRODUCT_ICON_PATHS[p];
                      return (
                        <SelectItem key={p} value={p}>
                          <div className="flex items-center gap-2">
                            {iconPath && (
                              <Image
                                src={iconPath}
                                alt={TICKET_PRODUCT_LABELS[p]}
                                width={16}
                                height={16}
                              />
                            )}
                            {TICKET_PRODUCT_LABELS[p]}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Status (only in edit mode) */}
        {mode === "edit" && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_testing">In Testing</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Provide more details about this ticket..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Assignee + Environment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignee_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assignee</FormLabel>
                <FormControl>
                  <UserSearch
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search by name or email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="environment_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment URL</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://staging.example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Bug-specific fields */}
        {isBug && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Bug Details
              </h3>

              <FormField
                control={form.control}
                name="steps_to_reproduce"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steps to Reproduce</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="1. Go to...\n2. Click on...\n3. Observe..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expected_behavior"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Behavior</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What should have happened..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actual_behavior"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Behavior</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What actually happened..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        )}

        {/* Attachments */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Screenshots / Attachments
          </label>
          <AttachmentUploader
            ticketId={ticket?.id}
            value={attachments}
            onChange={setAttachments}
            disabled={loading}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Ticket"
                : "Save Changes"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
