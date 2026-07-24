import Database from "@tauri-apps/plugin-sql";
import { z } from "zod";
import { PaneSchema, TaskSchema } from "./schemas";
import { isTauri } from "./utils";

export type Pane = z.infer<typeof PaneSchema>;
export type Task = z.infer<typeof TaskSchema>;

let dbInstance: Database | null = null;

async function getDb(): Promise<Database> {
  if (!isTauri()) {
    throw new Error("Tauri environment not available (running in standard browser)");
  }
  if (!dbInstance) {
    let retries = 10;
    while (retries > 0) {
      try {
        dbInstance = await Database.load("sqlite:ambient_board.db");
        
        await dbInstance.execute(`
          CREATE TABLE IF NOT EXISTS panes (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            title TEXT NOT NULL,
            position_x REAL NOT NULL,
            position_y REAL NOT NULL,
            width REAL NOT NULL,
            height REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);
        
        await dbInstance.execute(`
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            pane_id TEXT NOT NULL,
            content TEXT NOT NULL,
            completed INTEGER NOT NULL,
            order_index INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT
          );
        `);
        try {
          await dbInstance.execute(`ALTER TABLE tasks ADD COLUMN completed_at TEXT;`);
        } catch {
          // Column likely already exists
        }

        await dbInstance.execute(`
          CREATE INDEX IF NOT EXISTS idx_tasks_pane_id ON tasks(pane_id);
        `);
        break; // Success, exit retry loop
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, 300));
      }
    }
  }
  return dbInstance as Database;
}

export async function getPanes(): Promise<Pane[]> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM panes;");
  // sqlite booleans are typically 0/1 integers, but we don't have boolean in panes
  return z.array(PaneSchema).parse(rows);
}

export async function getPaneById(id: string): Promise<Pane | null> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM panes WHERE id = $1;", [id]);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return PaneSchema.parse(rows[0]);
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM tasks;");
  // mapped rows for completed
  const mappedRows = (rows as any[]).map(row => ({
    ...row,
    completed: row.completed === 1
  }));
  return z.array(TaskSchema).parse(mappedRows);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM tasks WHERE id = $1;", [id]);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row: any = rows[0];
  return TaskSchema.parse({ ...row, completed: row.completed === 1 });
}

export async function upsertPane(pane: Pane): Promise<void> {
  const db = await getDb();
  await db.execute(`
    INSERT INTO panes (id, board_id, title, position_x, position_y, width, height, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(id) DO UPDATE SET
      board_id = excluded.board_id,
      title = excluded.title,
      position_x = excluded.position_x,
      position_y = excluded.position_y,
      width = excluded.width,
      height = excluded.height,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `, [
    pane.id, pane.board_id, pane.title, pane.position_x, pane.position_y,
    pane.width, pane.height, pane.created_at, pane.updated_at
  ]);
}

export async function upsertTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.execute(`
    INSERT INTO tasks (id, pane_id, content, completed, order_index, created_at, updated_at, completed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT(id) DO UPDATE SET
      pane_id = excluded.pane_id,
      content = excluded.content,
      completed = excluded.completed,
      order_index = excluded.order_index,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      completed_at = excluded.completed_at
  `, [
    task.id, task.pane_id, task.content, task.completed ? 1 : 0,
    task.order_index, task.created_at, task.updated_at, task.completed_at || null
  ]);
}

export async function deleteTask(id: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

export async function deletePane(id: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE pane_id = $1", [id]);
  await db.execute("DELETE FROM panes WHERE id = $1", [id]);
}
