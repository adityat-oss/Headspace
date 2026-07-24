import { z } from "zod";
import { TaskSchema, PaneSchema, BoardSchema } from "../lib/schemas";

export type Task = z.infer<typeof TaskSchema>;
export type Pane = z.infer<typeof PaneSchema>;
export type Board = z.infer<typeof BoardSchema>;
