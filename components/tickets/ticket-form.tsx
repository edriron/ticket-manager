"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ticketSchema, type TicketFormValues } from "@/lib/validations";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

interface TicketFormProps {
  mode: "create" | "edit";
  ticket?: Ticket;
  currentUserId: string;
  onCancel?: () => void;
}

export function TicketForm({
  mode,
  ticket,
  currentUserId,
  onCancel,
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
        .select("id")
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

      toast.success("Ticket created successfully!");
      router.push(`/tickets/${newTicket.id}`);
      router.refresh();
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

      // Handle new attachments (those without an id)
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

      toast.success("Ticket updated!");
      router.refresh();
      onCancel?.();
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

        {/* Type + Priority row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Textarea
                  placeholder="Provide more details about this ticket..."
                  rows={4}
                  {...field}
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
