import { z } from "zod";
import { PaneSchema, TaskSchema } from "./schemas";
import { upsertPane, upsertTask, getPaneById, getTaskById, deletePane, deleteTask, Pane, Task } from "./db";

export const SyncMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("AUTH"), token: z.string() }),
  z.object({ type: z.literal("UPDATE_PANE"), pane: PaneSchema }),
  z.object({ type: z.literal("UPDATE_TASK"), task: TaskSchema }),
  z.object({ type: z.literal("DELETE_PANE"), id: z.string() }),
  z.object({ type: z.literal("DELETE_TASK"), id: z.string() }),
  z.object({ type: z.literal("PING") }),
  z.object({ type: z.literal("PONG") }),
]);

export type SyncMessage = z.infer<typeof SyncMessageSchema>;

interface EncryptedPayload {
  iv: string; // Base64
  data: string; // Base64
}

// Utility to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Utility to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class SyncClient {
  private ws: WebSocket | null = null;
  public url: string;
  public token: string;
  private cryptoKey: CryptoKey | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private pingInterval: number | null = null;
  public isConnected = false;
  public onConnectionChange?: (connected: boolean) => void;

  public onUpdatePane?: (pane: Pane) => void;
  public onUpdateTask?: (task: Task) => void;
  public onDeletePane?: (id: string) => void;
  public onDeleteTask?: (id: string) => void;

  constructor(url: string, token: string) {
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      throw new Error("Secure (wss://) or local (ws://) WebSocket URL required.");
    }
    this.url = url;
    this.token = token;
  }

  private async initCrypto() {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.token),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("ambient-board-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  private async encryptMessage(msg: SyncMessage): Promise<string> {
    if (!this.cryptoKey) await this.initCrypto();
    
    // AUTH and PING/PONG messages are sent unencrypted so the relay can process them
    if (msg.type === "AUTH" || msg.type === "PING" || msg.type === "PONG") {
      return JSON.stringify(msg);
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(msg));

    const encryptedContent = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.cryptoKey!,
      data
    );

    const payload: EncryptedPayload = {
      iv: arrayBufferToBase64(iv.buffer),
      data: arrayBufferToBase64(encryptedContent)
    };
    
    // Wrap in an ENCRYPTED type for the wire
    return JSON.stringify({ type: "ENCRYPTED", payload });
  }

  private async decryptMessage(rawString: string): Promise<SyncMessage | null> {
    try {
      const rawData = JSON.parse(rawString);
      
      // Unencrypted system messages
      if (rawData.type === "AUTH" || rawData.type === "PING" || rawData.type === "PONG") {
        return SyncMessageSchema.parse(rawData);
      }

      if (rawData.type === "ENCRYPTED" && rawData.payload) {
        if (!this.cryptoKey) await this.initCrypto();
        
        const payload: EncryptedPayload = rawData.payload;
        const iv = base64ToArrayBuffer(payload.iv);
        const data = base64ToArrayBuffer(payload.data);

        const decryptedContent = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(iv) },
          this.cryptoKey!,
          data
        );

        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(decryptedContent);
        const msg = JSON.parse(jsonStr);
        return SyncMessageSchema.parse(msg);
      }
      return null;
    } catch (err) {
      console.warn("Failed to decrypt or parse incoming message:", err);
      return null;
    }
  }

  public async connect() {
    await this.initCrypto();

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.warn("WebSocket connect error:", err);
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      if (this.onConnectionChange) this.onConnectionChange(true);
      
      this.sendMessage({ type: "AUTH", token: this.token });
      
      this.pingInterval = window.setInterval(() => {
        if (this.isConnected) {
          this.sendMessage({ type: "PING" });
        }
      }, 30000);
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = await this.decryptMessage(event.data);
        if (!msg) return;
        
        if (msg.type === "UPDATE_PANE") {
          const incoming = msg.pane;
          const existing = await getPaneById(incoming.id);
          
          if (!existing || new Date(incoming.updated_at) > new Date(existing.updated_at)) {
            if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
              await upsertPane(incoming);
            }
            if (this.onUpdatePane) {
              this.onUpdatePane(incoming);
            }
          }
        } else if (msg.type === "UPDATE_TASK") {
          const incoming = msg.task;
          const existing = await getTaskById(incoming.id);
          
          if (!existing || new Date(incoming.updated_at) > new Date(existing.updated_at)) {
            if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
              await upsertTask(incoming);
            }
            if (this.onUpdateTask) {
              this.onUpdateTask(incoming);
            }
          }
        } else if (msg.type === "DELETE_PANE") {
          if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
            await deletePane(msg.id);
          }
          if (this.onDeletePane) this.onDeletePane(msg.id);
        } else if (msg.type === "DELETE_TASK") {
          if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
            await deleteTask(msg.id);
          }
          if (this.onDeleteTask) this.onDeleteTask(msg.id);
        }
      } catch (err) {
        console.error("Failed to process sync message:", err);
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (this.reconnectAttempts < 3) {
        this.scheduleReconnect();
      } else {
        console.warn("WebSocket max reconnect attempts reached. Sync disabled until server is available.");
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.ws?.close();
    };
  }

  private cleanup() {
    this.isConnected = false;
    if (this.onConnectionChange) this.onConnectionChange(false);
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  public async sendMessage(msg: SyncMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const encryptedData = await this.encryptMessage(msg);
      this.ws.send(encryptedData);
    }
  }

  public sendUpdatePane(pane: Pane) {
    this.sendMessage({ type: "UPDATE_PANE", pane });
  }

  public sendUpdateTask(task: Task) {
    this.sendMessage({ type: "UPDATE_TASK", task });
  }

  public sendDeletePane(id: string) {
    this.sendMessage({ type: "DELETE_PANE", id });
  }

  public sendDeleteTask(id: string) {
    this.sendMessage({ type: "DELETE_TASK", id });
  }

  public disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
    }
  }
}
