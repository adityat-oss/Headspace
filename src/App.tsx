import { useState, useEffect, useRef } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Canvas } from "./components/Canvas";
import { TrayIndicator } from "./components/TrayIndicator";
import { ControlPanel, AppMode } from "./components/ControlPanel";
import { SyncModal } from "./components/SyncModal";
import { PaneSchema, TaskSchema } from "./lib/schemas";
import { Pane, Task } from "./types";
import { getPanes, getTasks, upsertPane, upsertTask, deleteTask, deletePane } from "./lib/db";
import { SyncClient } from "./lib/sync";

const mockBoardId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const primaryPaneId = "b1a7d189-25f3-4a1e-8e4d-89d8ccf2e293";
const notesPaneId = "e5f6a7b8-9c0d-4e1f-a2b3-c4d5e6f7a8b9";

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const defaultPanes = [
  PaneSchema.parse({
    id: primaryPaneId,
    board_id: mockBoardId,
    title: "Daily Priorities",
    position_x: 80,
    position_y: 110,
    width: 360,
    height: 480,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  PaneSchema.parse({
    id: notesPaneId,
    board_id: mockBoardId,
    title: "Quick Scratchpad & Notes",
    position_x: 480,
    position_y: 110,
    width: 380,
    height: 440,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
];

const defaultTasks = [
  TaskSchema.parse({
    id: "c3a1b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c",
    pane_id: primaryPaneId,
    content: "Welcome to Headspace!",
    completed: true,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }),
  TaskSchema.parse({
    id: "d4e5f6a7-8b9c-4d0e-a1b2-c3d4e5f6a7b8",
    pane_id: primaryPaneId,
    content: "Press Cmd+Shift+Space to toggle the floating whiteboard overlay anytime.",
    completed: false,
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  TaskSchema.parse({
    id: "f7a8b9c0-1d2e-4f3a-b4c5-d6e7f8a9b0c1",
    pane_id: primaryPaneId,
    content: "Press Cmd+Shift+B to instantly hide all UI or return to the active Dashboard.",
    completed: false,
    order_index: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  TaskSchema.parse({
    id: "8a9b0c1d-2e3f-4a5b-8c7d-8e9f0a1b2c3d",
    pane_id: notesPaneId,
    content: "You can also use the Menu Bar icon to change modes.",
    completed: false,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
];

function App() {
  const syncClientRef = useRef<SyncClient | null>(null);
  const windowLabelRef = useRef<string>("main");
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    windowLabelRef.current = getCurrentWebviewWindow().label;
  }
  const windowLabel = windowLabelRef.current;
  const [appMode, setAppModeState] = useState<AppMode>(() => {
    if (windowLabel === "dashboard") return "active";
    return (localStorage.getItem("ambient_app_mode") as AppMode) || "active";
  });
  const [panes, setPanes] = useState<Pane[]>(defaultPanes);
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [activePaneId, setActivePaneIdState] = useState<string>(() => {
    return localStorage.getItem("ambient_active_pane_id") || primaryPaneId;
  });

  const [isSyncEnabled, setIsSyncEnabled] = useState(() => localStorage.getItem("ambient_sync_enabled") === "true");
  const [syncUrl, setSyncUrl] = useState(() => {
    let url = localStorage.getItem("ambient_sync_url");
    if (!url) {
      url = `ws://localhost:3000`;
      localStorage.setItem("ambient_sync_url", url);
    }
    return url;
  });
  const [syncToken, setSyncToken] = useState(() => {
    let token = localStorage.getItem("ambient_sync_token");
    if (!token) {
      token = generateId().replace(/-/g, '').substring(0, 16);
      localStorage.setItem("ambient_sync_token", token);
    }
    return token;
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncConnected, setIsSyncConnected] = useState(false);
  const [isDeepSleep, setIsDeepSleep] = useState(false);

  const handleSetAppMode = async (mode: AppMode) => {
    setAppModeState(mode);
    localStorage.setItem("ambient_app_mode", mode);
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        await invoke("set_app_mode_native", { mode });
      } catch (err) {
        console.warn("Could not set app mode via Tauri:", err);
      }
    }
  };

  const handleSelectActivePaneId = (id: string) => {
    setActivePaneIdState(id);
    localStorage.setItem("ambient_active_pane_id", id);
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      const targetWindow = windowLabel === "main" ? "dashboard" : "main";
      emitTo(targetWindow, "active-pane-changed", { sender: windowLabel, activePaneId: id }).catch(() => {});
    }
  };

  useEffect(() => {
    async function initDb() {
      try {
        let localPanes = await getPanes();
        let localTasks = await getTasks();
        
        if (!localPanes || localPanes.length === 0 || (localPanes.length === 1 && localPanes[0].title === "To Do")) {
          try {
            for (const p of defaultPanes) await upsertPane(p);
            for (const t of defaultTasks) await upsertTask(t);
          } catch (err) {
            console.warn("Could not seed initial DB, using in-memory state:", err);
          }
          if (!localPanes || localPanes.length === 0) {
            localPanes = defaultPanes;
            localTasks = defaultTasks;
          } else {
            localPanes = [...localPanes, ...defaultPanes];
            localTasks = [...localTasks, ...defaultTasks];
          }
        }
        
        setPanes(localPanes);
        setTasks(localTasks);
        setActivePaneIdState(prev => {
          if (prev && localPanes.some(p => p.id === prev)) {
            return prev;
          }
          return localPanes.length > 0 ? localPanes[0].id : primaryPaneId;
        });
      } catch (err) {
        console.warn("Database initialization fallback to default cards:", err);
        setPanes(defaultPanes);
        setTasks(defaultTasks);
      }
    }
    
    initDb();

    let unlistenDataPromise: Promise<() => void> | null = null;
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        unlistenDataPromise = listen("data-changed", (event: any) => {
          if (event.payload && typeof event.payload === "object" && event.payload.sender === windowLabelRef.current) {
            return;
          }
          if (event.payload && event.payload.action) {
            const p = event.payload;
            
            // If we are main and this update came from a local window (e.g. dashboard), broadcast it to network
            if (windowLabelRef.current === "main" && p.sender !== "network" && p.sender !== "main") {
               // We need to access syncClientRef, which is available in closure scope
               // However, this listener closure might have stale references if we're not careful.
               // Since syncClientRef is a ref, it's safe to access its .current property.
            }
            if (p.action === "UPDATE_PANE") {
              setPanes(prev => { const idx = prev.findIndex(x => x.id === p.payload.id); if (idx !== -1) { const arr = [...prev]; arr[idx] = p.payload; return arr; } return [...prev, p.payload]; });
            } else if (p.action === "UPDATE_TASK") {
              setTasks(prev => { const idx = prev.findIndex(x => x.id === p.payload.id); if (idx !== -1) { const arr = [...prev]; arr[idx] = p.payload; return arr; } return [...prev, p.payload]; });
            } else if (p.action === "DELETE_PANE") {
              setPanes(prev => prev.filter(x => x.id !== p.payload));
              setTasks(prev => prev.filter(x => x.pane_id !== p.payload));
            } else if (p.action === "DELETE_TASK") {
              setTasks(prev => prev.filter(x => x.id !== p.payload));
            }
          } else {
            initDb();
          }
        });
      } catch (err) {
        console.warn("Could not listen to data-changed:", err);
      }
    }

    return () => {
      if (unlistenDataPromise) {
        unlistenDataPromise.then(f => f()).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      if (windowLabel === "main") {
        invoke("set_app_mode_native", { mode: appMode }).catch(err => {
          console.warn("Could not set initial app mode via Tauri:", err);
        });
      }
    }
  }, []);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | null = null;
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        unlistenPromise = listen("mode-changed", (event: any) => {
          if (typeof event.payload === "object" && event.payload !== null) {
            if ("appMode" in event.payload && event.payload.appMode) {
              const incoming = event.payload.appMode as AppMode;
              setAppModeState(incoming);
              localStorage.setItem("ambient_app_mode", incoming);
            }
          }
        });
      } catch (err) {
        console.warn("Could not listen to mode-changed:", err);
      }
    }

    let unlistenKeysPromise: Promise<() => void> | null = null;
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        unlistenKeysPromise = listen("sync-keys-changed", (event: any) => {
          if (event.payload && typeof event.payload === "object") {
             const p = event.payload;
             if (p.sender !== windowLabel) {
               setSyncUrl(p.url);
               setSyncToken(p.token);
               setIsSyncEnabled(p.enabled);
               if (syncClientRef.current) {
                 syncClientRef.current.disconnect();
                 syncClientRef.current = null;
               }
             }
          }
        });
      } catch (err) {
        console.warn("Could not listen to sync-keys-changed:", err);
      }
    }

    let unlistenActivePanePromise: Promise<() => void> | null = null;
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        unlistenActivePanePromise = listen("active-pane-changed", (event: any) => {
          if (event.payload && typeof event.payload === "object") {
             const p = event.payload;
             if (p.sender !== windowLabel && p.activePaneId) {
               setActivePaneIdState(p.activePaneId);
               localStorage.setItem("ambient_active_pane_id", p.activePaneId);
             }
          }
        });
      } catch (err) {
        console.warn("Could not listen to active-pane-changed:", err);
      }
    }

    let unlistenDeepSleepEnterPromise: Promise<() => void> | null = null;
    let unlistenDeepSleepExitPromise: Promise<() => void> | null = null;

    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        unlistenDeepSleepEnterPromise = listen("deep-sleep-enter", () => {
          setIsDeepSleep(true);
          if (syncClientRef.current) {
            syncClientRef.current.disconnect();
            syncClientRef.current = null;
          }
        });
        unlistenDeepSleepExitPromise = listen("deep-sleep-exit", () => {
          setIsDeepSleep(false);
        });
      } catch (err) {
        console.warn("Could not listen to deep sleep events:", err);
      }
    }

    return () => {
      if (unlistenPromise) unlistenPromise.then(f => f()).catch(() => {});
      if (unlistenKeysPromise) unlistenKeysPromise.then(f => f()).catch(() => {});
      if (unlistenActivePanePromise) unlistenActivePanePromise.then(f => f()).catch(() => {});
      if (unlistenDeepSleepEnterPromise) unlistenDeepSleepEnterPromise.then(f => f()).catch(() => {});
      if (unlistenDeepSleepExitPromise) unlistenDeepSleepExitPromise.then(f => f()).catch(() => {});
    };
  }, []);

  const effectiveMode: AppMode = windowLabel === "dashboard" ? "active" : appMode;

  useEffect(() => {
    const shouldConnect = isSyncEnabled && windowLabel === "main" && effectiveMode !== "passthrough" && !isDeepSleep;

    if (!shouldConnect) {
      if (syncClientRef.current) {
        syncClientRef.current.disconnect();
        syncClientRef.current = null;
      }
      setIsSyncConnected(false);
      return;
    }

    if (!syncClientRef.current) {
      try {
        const client = new SyncClient(syncUrl, syncToken);
        syncClientRef.current = client;
        client.onConnectionChange = (connected) => setIsSyncConnected(connected);
        
        client.onUpdatePane = (incoming) => {
          setPanes(prev => {
            const idx = prev.findIndex(p => p.id === incoming.id);
            if (idx !== -1) {
              const newPanes = [...prev];
              newPanes[idx] = incoming;
              return newPanes;
            }
            return [...prev, incoming];
          });
          const targetWindow = windowLabel === "main" ? "dashboard" : "main";
          emitTo(targetWindow, "data-changed", { sender: "network", action: "UPDATE_PANE", payload: incoming }).catch(() => {});
        };
        
        client.onUpdateTask = (incoming) => {
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === incoming.id);
            if (idx !== -1) {
              const newTasks = [...prev];
              newTasks[idx] = incoming;
              return newTasks;
            }
            return [...prev, incoming];
          });
          const targetWindow = windowLabel === "main" ? "dashboard" : "main";
          emitTo(targetWindow, "data-changed", { sender: "network", action: "UPDATE_TASK", payload: incoming }).catch(() => {});
        };

        client.onDeletePane = (id) => {
          setPanes(prev => prev.filter(p => p.id !== id));
          setTasks(prev => prev.filter(t => t.pane_id !== id));
          const targetWindow = windowLabel === "main" ? "dashboard" : "main";
          emitTo(targetWindow, "data-changed", { sender: "network", action: "DELETE_PANE", payload: id }).catch(() => {});
        };

        client.onDeleteTask = (id) => {
          setTasks(prev => prev.filter(t => t.id !== id));
          const targetWindow = windowLabel === "main" ? "dashboard" : "main";
          emitTo(targetWindow, "data-changed", { sender: "network", action: "DELETE_TASK", payload: id }).catch(() => {});
        };
        
        // Also listen for local changes to forward to network here so we have fresh closure access
        let unlistenDataPromise: Promise<() => void> | null = null;
        if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
          unlistenDataPromise = listen("data-changed", (event: any) => {
            if (event.payload && event.payload.action && event.payload.sender !== "network" && event.payload.sender !== "main") {
               const p = event.payload;
               if (p.action === "UPDATE_PANE") client.sendUpdatePane(p.payload);
               else if (p.action === "UPDATE_TASK") client.sendUpdateTask(p.payload);
               else if (p.action === "DELETE_PANE") client.sendDeletePane(p.payload);
               else if (p.action === "DELETE_TASK") client.sendDeleteTask(p.payload);
            }
          });
          unlistenDataPromise.catch(console.error);
        }

        return () => {
          client.disconnect();
          if (unlistenDataPromise) {
            unlistenDataPromise.then(fn => fn()).catch(() => {});
          }
        };
        client.onConnectionChange = (connected) => setIsSyncConnected(connected);
        client.connect();
      } catch (err) {
        console.warn("SyncClient connect failed:", err);
        setIsSyncConnected(false);
      }
    }

    return () => {};
  }, [isSyncEnabled, syncUrl, syncToken, windowLabel, effectiveMode, isDeepSleep]);

  const handleUpdatePane = async (updatedPane: Pane) => {
    setPanes(prev => prev.map(p => p.id === updatedPane.id ? updatedPane : p));
    updatedPane.updated_at = new Date().toISOString();
    await upsertPane(updatedPane);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendUpdatePane(updatedPane);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "UPDATE_PANE", payload: updatedPane }).catch(() => {});
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    updatedTask.updated_at = new Date().toISOString();
    await upsertTask(updatedTask);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendUpdateTask(updatedTask);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "UPDATE_TASK", payload: updatedTask }).catch(() => {});
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await deleteTask(id);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendDeleteTask(id);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "DELETE_TASK", payload: id }).catch(() => {});
  };

  const handleDeletePane = async (id: string) => {
    setPanes(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (activePaneId === id && remaining.length > 0) {
        handleSelectActivePaneId(remaining[0].id);
      }
      return remaining;
    });
    setTasks(prev => prev.filter(t => t.pane_id !== id));
    await deletePane(id);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendDeletePane(id);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "DELETE_PANE", payload: id }).catch(() => {});
  };

  const handleAddPane = async (title: string) => {
    const newId = generateId();
    const newPane = PaneSchema.parse({
      id: newId,
      board_id: mockBoardId,
      title: title,
      position_x: 100,
      position_y: 100,
      width: 360,
      height: 480,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setPanes(prev => [...prev, newPane]);
    handleSelectActivePaneId(newId);
    await upsertPane(newPane);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendUpdatePane(newPane);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "UPDATE_PANE", payload: newPane }).catch(() => {});
  };

  const handleCreateUntitledPane = async () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await handleAddPane(`Quick Scratchpad (${timeStr})`);
  };

  const handleAddTaskToPane = async (paneId: string, content: string) => {
    const newId = generateId();
    const paneTasks = tasks.filter(t => t.pane_id === paneId);
    const maxOrder = paneTasks.length > 0 ? Math.max(...paneTasks.map(t => t.order_index)) : -1;
    const newTask = TaskSchema.parse({
      id: newId,
      pane_id: paneId,
      content: content,
      completed: false,
      order_index: maxOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setTasks(prev => [...prev, newTask]);
    await upsertTask(newTask);
    if (isSyncEnabled && syncClientRef.current) {
      syncClientRef.current.sendUpdateTask(newTask);
    }
    const targetWindow = windowLabel === "main" ? "dashboard" : "main";
    emitTo(targetWindow, "data-changed", { sender: windowLabel, action: "UPDATE_TASK", payload: newTask }).catch(() => {});
  };

  const handleQuickTask = (content: string) => {
    const targetPaneId = activePaneId || (panes.length > 0 ? panes[0].id : primaryPaneId);
    handleAddTaskToPane(targetPaneId, content);
  };

  const handleSaveAndToggleSync = (newUrl: string, newToken: string, enabled: boolean, fromIpc = false) => {
    setSyncUrl(newUrl);
    setSyncToken(newToken);
    setIsSyncEnabled(enabled);
    localStorage.setItem("ambient_sync_url", newUrl);
    localStorage.setItem("ambient_sync_token", newToken);
    localStorage.setItem("ambient_sync_enabled", String(enabled));
    
    if (syncClientRef.current) {
      syncClientRef.current.disconnect();
      syncClientRef.current = null;
    }

    if (!fromIpc) {
      const targetWindow = windowLabel === "main" ? "dashboard" : "main";
      emitTo(targetWindow, "sync-keys-changed", { sender: windowLabel, url: newUrl, token: newToken, enabled }).catch(() => {});
    }
  };

  if (isDeepSleep) {
    return null;
  }

  return (
    <>
      <ControlPanel
        appMode={effectiveMode}
        onSetAppMode={handleSetAppMode}
        panes={panes}
        activePaneId={activePaneId}
        onSelectActivePaneId={handleSelectActivePaneId}
        onAddPane={handleAddPane}
        onAddTask={handleQuickTask}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isSyncEnabled={isSyncEnabled}
        isConnected={isSyncConnected}
      />

      <Canvas 
        appMode={effectiveMode}
        onSetAppMode={handleSetAppMode}
        panes={panes} 
        tasks={tasks} 
        activePaneId={activePaneId}
        onSelectActivePaneId={handleSelectActivePaneId}
        onUpdatePane={handleUpdatePane}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onDeletePane={handleDeletePane}
        onAddTaskToPane={handleAddTaskToPane}
        onAddPane={handleAddPane}
        onAddUntitledPane={handleCreateUntitledPane}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isSyncEnabled={isSyncEnabled}
        isConnected={isSyncConnected}
      />

      <TrayIndicator isInteractive={effectiveMode !== "passthrough"} />

      <SyncModal
        globalFont="Caveat"
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncUrl={syncUrl}
        syncToken={syncToken}
        isSyncEnabled={isSyncEnabled}
        isConnected={isSyncConnected}
        onSaveAndToggle={handleSaveAndToggleSync}
      />
    </>
  );
}

export default App;
