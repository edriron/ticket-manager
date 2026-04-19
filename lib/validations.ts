import { z } from "zod";
import { PRODUCT_IDS } from "@/lib/products";

export const displayNameSchema = z.object({
  display_name: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9 _-]+$/,
      "Only letters, numbers, spaces, hyphens and underscores allowed",
    ),
});

export const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  type: z.enum(["bug", "feature_request"] as const),
  status: z.enum([
    "todo",
    "in_progress",
    "pending",
    "in_testing",
    "done",
  ] as const),
  priority: z.enum(["low", "medium", "high", "critical"] as const),
  product: z.enum(PRODUCT_IDS),
  description: z
    .string()
    .max(10000, "Description is too long")
    .optional()
    .or(z.literal("")),
  environment_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  assignee_id: z.string().uuid().optional().or(z.literal("")).or(z.null()),
  steps_to_reproduce: z.string().max(5000).optional().or(z.literal("")),
  expected_behavior: z.string().max(5000).optional().or(z.literal("")),
  actual_behavior: z.string().max(5000).optional().or(z.literal("")),
});

export const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long"),
});

export const profileSchema = z.object({
  display_name: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9 _-]+$/,
      "Only letters, numbers, spaces, hyphens and underscores allowed",
    ),
  avatar_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type TicketFormValues = z.infer<typeof ticketSchema>;
export type CommentFormValues = z.infer<typeof commentSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
export type DisplayNameFormValues = z.infer<typeof displayNameSchema>;
