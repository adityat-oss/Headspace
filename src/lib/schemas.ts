import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F-]{36}$/;

export const TaskSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid UUID format"),
  pane_id: z.string().regex(uuidRegex, "Invalid UUID format"),
  content: z.string(),
  completed: z.boolean(),
  order_index: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable().optional().transform(v => v ?? undefined),
});

export const PaneSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid UUID format"),
  board_id: z.string().regex(uuidRegex, "Invalid UUID format"),
  title: z.string(),
  position_x: z.number(),
  position_y: z.number(),
  width: z.number(),
  height: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const BoardSchema = z.object({
  id: z.string().regex(uuidRegex, "Invalid UUID format"),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
