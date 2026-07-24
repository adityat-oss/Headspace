import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Pane, Task } from "../types";
import { TaskItem } from "./TaskItem";
import { Plus, Trash2, Star, Clock, Calendar, ChevronDown, Check, LayoutGrid, List, Wifi, WifiOff, Sparkles, FolderPlus, FilePlus, Settings, Palette } from "lucide-react";
import { AppMode } from "./ControlPanel";
import { SettingsModal } from "./SettingsModal";

interface CanvasProps {
  appMode: AppMode;
  onSetAppMode?: (mode: AppMode) => void;
  panes: Pane[];
  tasks: Task[];
  activePaneId: string;
  onSelectActivePaneId: (id: string) => void;
  onUpdatePane: (pane: Pane) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onDeletePane: (id: string) => void;
  onAddTaskToPane: (paneId: string, content: string) => void;
  onAddPane?: (title: string) => void;
  onAddUntitledPane?: () => void;
  onOpenSyncModal?: () => void;
  isSyncEnabled?: boolean;
  isConnected?: boolean;
}

const FONT_MAP: Record<string, string> = {
  "font-marker": "'Caveat', cursive",
  "font-serif-app": "'EB Garamond', serif",
  "font-hand1": "'Give You Glory', cursive",
  "font-hand2": "'Patrick Hand', cursive"
};

const NOISE_B64 = "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC45IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')";



export const THEME_MAP: Record<string, { bg: React.CSSProperties, ink: string, accentColor: string, accentBg: string }> = {
  "minimalist": {
    bg: { backgroundColor: "#0a0a0a" },
    ink: "#ffffff", // Pure solid white
    accentColor: "#ffffff", 
    accentBg: "rgba(255, 255, 255, 0.1)",
  },
  "forest": {
    bg: { 
      background: `radial-gradient(circle at 50% 50%, rgba(6,78,59,0.4) 0%, rgba(2,44,34,0.8) 100%), ${NOISE_B64}`,
      backdropFilter: "blur(60px)", WebkitBackdropFilter: "blur(60px)", backgroundBlendMode: "overlay"
    },
    ink: "rgba(167, 243, 208, 0.85)", // Semi-transparent emerald-200 for depth blending
    accentColor: "#34d399", 
    accentBg: "rgba(16, 185, 129, 0.25)",
  },
  "cosmic": {
    bg: { 
      background: `radial-gradient(circle at 50% 50%, rgba(20,10,40,0.8) 0%, rgba(5,2,15,0.98) 100%), ${NOISE_B64}`,
      backdropFilter: "blur(60px)", WebkitBackdropFilter: "blur(60px)", backgroundBlendMode: "overlay"
    },
    ink: "rgba(224, 231, 255, 0.85)", // Semi-transparent indigo-100 for depth blending
    accentColor: "#a78bfa", // violet-400
    accentBg: "rgba(139, 92, 246, 0.25)",
  },
  "mahogany": {
    bg: { 
      background: `radial-gradient(circle at 50% 50%, rgba(60,20,5,0.7) 0%, rgba(20,5,0,0.95) 100%), ${NOISE_B64}`,
      backdropFilter: "blur(60px)", WebkitBackdropFilter: "blur(60px)", backgroundBlendMode: "overlay"
    },
    ink: "rgba(253, 230, 138, 0.85)", // Semi-transparent amber-200 for depth blending
    accentColor: "#fbbf24",
    accentBg: "rgba(245, 158, 11, 0.2)",
  }
};

export const Canvas: React.FC<CanvasProps> = React.memo(({
  appMode,
  onSetAppMode: _onSetAppMode,
  panes,
  tasks,
  activePaneId,
  onSelectActivePaneId,
  onUpdatePane,
  onUpdateTask,
  onDeleteTask,
  onDeletePane,
  onAddTaskToPane,
  onAddPane,
  onAddUntitledPane,
  onOpenSyncModal,
  isSyncEnabled,
  isConnected,
}) => {
  const [inputState, setInputState] = useState<{ [paneId: string]: string }>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleContent, setEditTitleContent] = useState("");
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [isCompactList, setIsCompactList] = useState(false);
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [trayTheme, setTrayTheme] = useState(() => localStorage.getItem("ambient_tray_theme") || "system");
  const [showSettings, setShowSettings] = useState(false);
  const [globalFont, setGlobalFont] = useState(() => localStorage.getItem("ambient_global_font") || "font-marker");
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("ambient_active_theme") || "minimalist");
  const [experimentalDockFloat, setExperimentalDockFloat] = useState(() => localStorage.getItem("ambient_dock_float") === "true");
  const [overlayScale, setOverlayScale] = useState(() => Number(localStorage.getItem("ambient_overlay_scale")) || 1.0);

  useEffect(() => { localStorage.setItem("ambient_global_font", globalFont); }, [globalFont]);
  useEffect(() => { localStorage.setItem("ambient_active_theme", activeTheme); }, [activeTheme]);
  useEffect(() => { localStorage.setItem("ambient_dock_float", String(experimentalDockFloat)); }, [experimentalDockFloat]);
  useEffect(() => { localStorage.setItem("ambient_overlay_scale", String(overlayScale)); }, [overlayScale]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      invoke("set_tray_icon", { theme: trayTheme }).catch(() => {});
      if (appMode === "active" && experimentalDockFloat) {
        invoke("force_window_level").catch(() => {});
      }
    }
  }, [trayTheme, appMode, experimentalDockFloat]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ambient_global_font" && e.newValue) setGlobalFont(e.newValue);
      if (e.key === "ambient_active_theme" && e.newValue) setActiveTheme(e.newValue);
      if (e.key === "ambient_dock_float" && e.newValue) setExperimentalDockFloat(e.newValue === "true");
      if (e.key === "ambient_overlay_scale" && e.newValue) setOverlayScale(Number(e.newValue));
      if (e.key === "ambient_tray_theme" && e.newValue) setTrayTheme(e.newValue);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTrayTheme = () => {
    const nextTheme = trayTheme === "system" ? "regular" : "system";
    setTrayTheme(nextTheme);
    localStorage.setItem("ambient_tray_theme", nextTheme);
  };

  const tasksByPane = React.useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.pane_id]) map[t.pane_id] = [];
      map[t.pane_id].push(t);
    }
    for (const paneId in map) {
      map[paneId].sort((a, b) => a.order_index - b.order_index);
    }
    return map;
  }, [tasks]);

  const currentTheme = THEME_MAP[activeTheme] || THEME_MAP["minimalist"];
  
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-accent', currentTheme.accentColor);
    document.documentElement.style.setProperty('--theme-accent-bg', currentTheme.accentBg);
    document.documentElement.style.setProperty('--theme-ink', currentTheme.ink);
  }, [activeTheme, currentTheme]);

  const themeVars = {
    "--theme-accent": currentTheme.accentColor,
    "--theme-accent-bg": currentTheme.accentBg,
  } as React.CSSProperties;

  if (appMode === "passthrough") {
    return null;
  }

  const handleInputChange = (paneId: string, val: string) => {
    setInputState((prev) => ({ ...prev, [paneId]: val }));
  };

  const handleInputSubmit = (e: React.FormEvent, paneId: string) => {
    e.preventDefault();
    const val = inputState[paneId]?.trim();
    if (val) {
      onAddTaskToPane(paneId, val);
      setInputState((prev) => ({ ...prev, [paneId]: "" }));
    }
  };

  const handleStartEditTitle = (pane: Pane) => {
    setEditingTitleId(pane.id);
    setEditTitleContent(pane.title);
  };

  const handleSaveTitle = (pane: Pane) => {
    if (editTitleContent.trim() && editTitleContent !== pane.title) {
      onUpdatePane({ ...pane, title: editTitleContent.trim() });
    }
    setEditingTitleId(null);
  };

  // ==========================================
  // REGULAR MODE: NVIDIA Overlay Level of Isolation (ONLY TEXT, ZERO PILLS, ZERO BOXES)
  // "consider the nvidia overlay that shows up at the top of the screen. that is the level of isolation I want. that means in regular mode I ONLY see text. no pills. same with passthrough. no pills at all. Subtle White/Pastel Accents: Checkboxes and hover effects now use soft, light versions of colors near default white (text-emerald-200/90 and text-sky-100/80), with generous breathing room (py-2.5 px-3 rounded-2xl) so nothing feels bunched together."
  // ==========================================
  if (appMode === "regular") {
    const activePane = panes.find((p) => p.id === activePaneId) || panes[0];
    if (!activePane) {
      return (
        <div className="w-screen h-screen fixed inset-0 bg-transparent flex items-center justify-center pointer-events-auto">
          <p className="font-marker text-3xl text-white/90 italic drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
            No active taskboard found. Press Cmd/Ctrl+Shift+B to open the Management Hub and create one!
          </p>
        </div>
      );
    }

    const activeTasks = tasksByPane[activePane.id] || [];

    return (
      <div className="w-screen h-screen fixed inset-0 z-40 pointer-events-none flex" style={themeVars}>
        {/* Pure Text Container — Zero background boxes, zero card borders, zero pills! */}
        <div 
          className="w-full max-w-[500px] pt-14 pb-12 px-10 flex flex-col justify-start pointer-events-auto relative"
          style={{ transform: `scale(${overlayScale})`, transformOrigin: 'top left' }}
        >
          
          {/* Subtle Text Header (NVIDIA Overlay Style) */}
          <div className="flex items-center justify-between pb-3 shrink-0 relative">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {editingTitleId === activePane.id ? (
                <input
                  type="text"
                  value={editTitleContent}
                  onChange={(e) => setEditTitleContent(e.target.value)}
                  onBlur={() => handleSaveTitle(activePane)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle(activePane)}
                  autoFocus
                  className="text-3xl font-normal tracking-wide bg-black/60 border border-white/20 rounded-xl px-2 py-1 outline-none w-full shadow-inner"
                  style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                />
              ) : (
                <div className="flex items-center gap-1.5 min-w-0 cursor-pointer group" onClick={() => setShowBoardMenu(!showBoardMenu)}>
                  <h2
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartEditTitle(activePane); }}
                    className="text-3xl font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] truncate group-hover:opacity-80 transition-opacity"
                    title={`${activePane.title} (Click to cycle boards, double-click to rename)`}
                    style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                  >
                    {activePane.title}
                  </h2>
                  {panes.length > 1 && (
                    <ChevronDown size={16} className="text-white/60 group-hover:text-white transition-colors shrink-0 mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]" />
                  )}
                </div>
              )}
            </div>

            {/* Subtle Floating Menu for Board Switching */}
            {showBoardMenu && panes.length > 1 && (
              <div className="absolute top-12 left-0 bg-neutral-950 border border-white/15 rounded-2xl p-2 shadow-2xl w-64 z-50 flex flex-col gap-1 animate-fade-in backdrop-blur-xl">
                <div className="text-[11px] font-mono text-neutral-400 px-3 py-1 border-b border-white/10 mb-1">
                  Select Overlay Board:
                </div>
                {panes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectActivePaneId(p.id);
                      setShowBoardMenu(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left font-marker text-lg transition-all ${
                      p.id === activePane.id
                        ? "bg-white/10 text-emerald-200/90 font-bold"
                        : "text-neutral-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{p.title}</span>
                    {p.id === activePane.id && <Check size={15} className="text-emerald-300 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pure Floating Text Tasks with Subtle White/Pastel Accents and Generous Breathing Room */}
          <div className="space-y-3 my-2 pr-2 overflow-y-auto max-h-[70vh]">
            {activeTasks.length === 0 ? (
              <p className="font-marker text-2xl text-white/60 italic py-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                No tasks yet — type below to add!
              </p>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] self-start transition-all duration-200 hover:translate-x-1"
                >
                  <TaskItem
                    task={task}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    isInteractive={true}
                    isOverlay={true}
                    fontFamily={FONT_MAP[globalFont]}
                    color={THEME_MAP[activeTheme].ink}
                  />
                </div>
              ))
            )}
          </div>

          {/* Subtle Text Input right below the tasks (NVIDIA Overlay Style) */}
          <form
            onSubmit={(e) => handleInputSubmit(e, activePane.id)}
            className="pt-3 mt-1 flex items-center gap-2 shrink-0 w-full"
          >
            <input
              type="text"
              value={inputState[activePane.id] || ""}
              onChange={(e) => handleInputChange(activePane.id, e.target.value)}
              placeholder={`+ Add task to ${activePane.title}...`}
              className="w-full bg-transparent hover:bg-black/30 focus:bg-black/50 border border-transparent focus:border-white/15 rounded-2xl px-3 py-2.5 text-xl placeholder-white/40 outline-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]"
              style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
            />
          </form>
        </div>

        {/* The rest of the screen to the right is 100% transparent and passes pointer events right through */}
        <div className="flex-1 h-screen pointer-events-none" />
      </div>
    );
  }

  // ==========================================
  // ACTIVE MODE: True Full-Screen Application inside dedicated Dashboard Window
  // Perfectly proportioned typography, elegant margins, and zero bottom black cutoff
  // ==========================================
  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBoardTitle.trim() && onAddPane) {
      onAddPane(newBoardTitle.trim());
      setNewBoardTitle("");
      setShowNewBoardInput(false);
    }
  };

  return (
    <div 
      className="w-screen h-screen fixed inset-0 z-40 overflow-y-auto p-8 pt-8 pb-16 pointer-events-auto flex flex-col justify-between"
      style={{ ...currentTheme.bg, ...themeVars }}
    >
      {/* Top Header & Integrated Navigation Controls (Zero Overlapping Pills) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 shrink-0 max-w-7xl mx-auto w-full px-4">
        <div>
          <h1 className="font-marker text-3xl text-white tracking-wide">Headspace</h1>
        </div>

        {/* Integrated Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Layout Toggle */}
          <button
            onClick={() => setIsCompactList(!isCompactList)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-sm transition-all"
            title="Toggle between Grid View and Compact List View"
            style={{ fontFamily: FONT_MAP[globalFont] }}
          >
            {isCompactList ? <LayoutGrid size={16} className="text-[var(--theme-accent)] mix-blend-screen opacity-90" /> : <List size={16} className="text-[var(--theme-accent)] mix-blend-screen opacity-90" />}
            <span>{isCompactList ? "Grid View" : "Compact List"}</span>
          </button>

          {/* New Taskpage Buttons */}
          {showNewBoardInput ? (
            <form onSubmit={handleCreateBoardSubmit} className="flex items-center gap-1.5 bg-neutral-900 border border-white/20 rounded-2xl px-3 py-1.5 shadow-inner">
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Taskboard Name..."
                autoFocus
                className="bg-transparent text-sm text-white placeholder-neutral-500 outline-none w-36"
                style={{ fontFamily: FONT_MAP[globalFont] }}
              />
              <button
                type="submit"
                disabled={!newBoardTitle.trim()}
                className={`px-2.5 py-1 rounded-xl disabled:opacity-40 font-bold text-xs transition-all ${activeTheme === 'minimalist' ? 'bg-white text-black hover:bg-neutral-200' : 'bg-[var(--theme-accent)] text-black hover:opacity-80'}`}
                style={{ fontFamily: FONT_MAP[globalFont] }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowNewBoardInput(false)}
                className="text-neutral-400 hover:text-white font-mono text-xs px-1"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewBoardInput(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-sm transition-all shadow-sm ${activeTheme === 'minimalist' ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white' : 'bg-[var(--theme-accent-bg)] hover:bg-[var(--theme-accent)]/30 border-[var(--theme-accent)]/30 text-[var(--theme-accent)]'}`}
                style={{ fontFamily: FONT_MAP[globalFont] }}
              >
                <FolderPlus size={16} className="mix-blend-screen opacity-90" />
                <span>+ New Taskpage</span>
              </button>
              {onAddUntitledPane && (
                <button
                  onClick={onAddUntitledPane}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs transition-all"
                  title="Create instant temporary or untitled taskpage without naming"
                  style={{ fontFamily: FONT_MAP[globalFont] }}
                >
                  <FilePlus size={15} className="text-[var(--theme-accent)] mix-blend-screen opacity-90" />
                  <span>+ Quicknote</span>
                </button>
              )}
            </div>
          )}

          {/* Tray Theme Button */}
          <button
            onClick={toggleTrayTheme}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-sm transition-all"
            title="Toggle Tray Icon Theme (System auto Light/Dark vs Colored)"
            style={{ fontFamily: FONT_MAP[globalFont] }}
          >
            <Palette size={16} className="text-[var(--theme-accent)] mix-blend-screen opacity-90" />
            <span>Icon: {trayTheme === "system" ? "Auto" : "Colored"}</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--theme-accent)] transition-all"
            title="Open Settings"
          >
            <Settings size={18} className="mix-blend-screen opacity-90" />
          </button>

              {/* Cloud Sync Button */}
          {onOpenSyncModal && (
            <button
              onClick={onOpenSyncModal}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm transition-all border ${
                isSyncEnabled
                  ? isConnected
                    ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/40 text-[var(--theme-accent)] shadow-md shadow-[var(--theme-accent)]/20"
                    : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
              }`}
              style={{ fontFamily: FONT_MAP[globalFont] }}
            >
              {isSyncEnabled ? (
                isConnected ? <Wifi size={16} className="mix-blend-screen opacity-90" /> : <Sparkles size={16} className="animate-pulse mix-blend-screen opacity-90" />
              ) : (
                <WifiOff size={16} className="mix-blend-screen opacity-90" />
              )}
              <span>Cloud Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Boards Area (Grid vs Compact List) */}
      <div className="w-full max-w-7xl mx-auto flex-1 overflow-y-auto py-8 px-4">
        {isCompactList ? (
          /* COMPACT LIST VIEW: Sleek, scannable title list showing counts and quick controls */
          <div className="space-y-4 max-w-5xl mx-auto">
            {panes.map((pane) => {
              const paneTasks = tasksByPane[pane.id] || [];
              const completedCount = paneTasks.filter((t) => t.completed).length;
              const isCurrentActive = activePaneId === pane.id;

              return (
                <div
                  key={pane.id}
                  className={`bg-neutral-900/70 hover:bg-neutral-900/90 transition-all duration-200 border ${
                    isCurrentActive ? "border-emerald-500/50 shadow-lg shadow-emerald-950/20" : "border-white/10"
                  } rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button
                      onClick={() => onSelectActivePaneId(pane.id)}
                      className={`p-2 rounded-xl transition-all ${
                        isCurrentActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-neutral-500 hover:text-white"
                      }`}
                      title={isCurrentActive ? "Active Overlay Board" : "Click to Set as Active Overlay Board"}
                    >
                      <Star size={18} className={isCurrentActive ? "fill-emerald-300" : ""} />
                    </button>

                    <div className="min-w-0 flex-1">
                      {editingTitleId === pane.id ? (
                        <input
                          type="text"
                          value={editTitleContent}
                          onChange={(e) => setEditTitleContent(e.target.value)}
                          onBlur={() => handleSaveTitle(pane)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveTitle(pane)}
                          className="text-xl bg-black/60 border border-white/20 rounded-xl px-2 py-0.5 outline-none w-full"
                          style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                        />
                      ) : (
                        <h3
                          onDoubleClick={() => handleStartEditTitle(pane)}
                          className="text-xl truncate cursor-text"
                          title={`${pane.title} (Double-click to rename)`}
                          style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                        >
                          {pane.title}
                        </h3>
                      )}
                      <p className="font-mono text-xs text-neutral-400 mt-0.5">
                        {paneTasks.length} total tasks ({completedCount} completed) • Created {new Date(pane.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <form
                      onSubmit={(e) => handleInputSubmit(e, pane.id)}
                      className="flex items-center gap-1.5 w-64 shrink-0"
                    >
                      <input
                        type="text"
                        value={inputState[pane.id] || ""}
                        onChange={(e) => handleInputChange(pane.id, e.target.value)}
                        placeholder={`+ Quick add to ${pane.title}...`}
                        className="w-full bg-black/40 hover:bg-black/60 focus:bg-black/80 border border-white/10 rounded-xl px-3 py-1.5 text-sm placeholder-neutral-500 outline-none"
                        style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                      />
                      <button
                        type="submit"
                        disabled={!inputState[pane.id]?.trim()}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/10 text-neutral-200"
                        title="Add Task"
                      >
                        <Plus size={15} />
                      </button>
                    </form>

                    <button
                      onClick={() => onDeletePane(pane.id)}
                      className="text-neutral-500 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-white/10"
                      title="Remove taskpage"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* GRID VIEW: Full cards with generous margins and balanced typography */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {panes.map((pane) => {
              const paneTasks = tasksByPane[pane.id] || [];

              const isCurrentActive = activePaneId === pane.id;

              return (
                <div
                  key={pane.id}
                  className={`bg-neutral-900/60 hover:bg-neutral-900/80 transition-all duration-300 border ${
                    isCurrentActive ? "border-emerald-500/40 shadow-xl shadow-emerald-950/30" : "border-white/10 shadow-xl"
                  } rounded-3xl p-6 flex flex-col justify-between h-[540px] overflow-hidden`}
                >
                  {/* Board Header & Active Badge */}
                  <div className="flex flex-col gap-2.5 pb-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between">
                      {editingTitleId === pane.id ? (
                        <input
                          type="text"
                          value={editTitleContent}
                          onChange={(e) => setEditTitleContent(e.target.value)}
                          onBlur={() => handleSaveTitle(pane)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveTitle(pane)}
                          autoFocus
                          className="text-2xl text-neutral-100 bg-black/60 border border-white/20 rounded-xl px-2.5 py-1 outline-none w-full shadow-inner"
                          style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                        />
                      ) : (
                        <h2
                          onDoubleClick={() => handleStartEditTitle(pane)}
                          className="text-2xl text-neutral-100 cursor-text truncate flex-1 tracking-wide"
                          title={`${pane.title} (Double-click to rename)`}
                          style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                        >
                          {pane.title}
                        </h2>
                      )}

                      <button
                        onClick={() => onDeletePane(pane.id)}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-white/10 shrink-0 ml-2"
                        title="Remove taskpage"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-neutral-500" />
                        <span className="font-mono text-[11px] text-neutral-400">Created: {new Date(pane.created_at).toLocaleDateString()}</span>
                      </div>

                      <button
                        onClick={() => onSelectActivePaneId(pane.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-marker text-sm transition-all border ${
                          isCurrentActive
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200/90 font-bold"
                            : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <Star size={13} className={isCurrentActive ? "text-emerald-300 fill-emerald-300" : ""} />
                        <span>{isCurrentActive ? "★ Active Overlay" : "Set Active Overlay"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Task List with Timestamps & Duration */}
                  <div className="space-y-2 flex-1 overflow-y-auto pr-1 my-3">
                    {paneTasks.length === 0 ? (
                      <p className="font-marker text-lg text-neutral-500 italic py-8 text-center">
                        No tasks yet — add below!
                      </p>
                    ) : (
                      paneTasks.map((task) => {
                        const createdTime = new Date(task.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        const completedTime = task.completed && task.completed_at
                          ? new Date(task.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : null;

                        return (
                          <div key={task.id} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-b-0">
                            <TaskItem
                              task={task}
                              onUpdate={onUpdateTask}
                              onDelete={onDeleteTask}
                              isInteractive={true}
                              isOverlay={false}
                              fontFamily={FONT_MAP[globalFont]}
                              color={THEME_MAP[activeTheme].ink}
                            />
                            <div className="flex items-center justify-between px-3 text-[10px] text-neutral-500 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> Added: {createdTime}
                              </span>
                              {completedTime && (
                                <span className="text-emerald-300/80">Completed at {completedTime}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Quick Input */}
                  <form
                    onSubmit={(e) => handleInputSubmit(e, pane.id)}
                    className="pt-3 border-t border-white/10 flex items-center gap-2 shrink-0"
                  >
                    <input
                      type="text"
                      value={inputState[pane.id] || ""}
                      onChange={(e) => handleInputChange(pane.id, e.target.value)}
                      placeholder={`+ Add task to ${pane.title}...`}
                      className="w-full bg-transparent border border-white/5 focus:border-white/20 rounded-xl px-3 py-2 text-lg placeholder-white/30 outline-none transition-all"
                      style={{ fontFamily: FONT_MAP[globalFont], color: THEME_MAP[activeTheme].ink }}
                    />
                    <button
                      type="submit"
                      disabled={!inputState[pane.id]?.trim()}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/10 text-neutral-200 transition-all shrink-0"
                      title="Add Task"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          globalFont={globalFont}
          setGlobalFont={setGlobalFont}
          activeTheme={activeTheme}
          setActiveTheme={setActiveTheme}
          experimentalDockFloat={experimentalDockFloat}
          setExperimentalDockFloat={setExperimentalDockFloat}
          overlayScale={overlayScale}
          setOverlayScale={setOverlayScale}
        />
      )}
    </div>
  );
});
