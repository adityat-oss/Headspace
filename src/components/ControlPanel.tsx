import React from "react";
import { Pane } from "../types";

export type AppMode = "passthrough" | "regular" | "active";

export interface ControlPanelProps {
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  panes: Pane[];
  activePaneId: string;
  onSelectActivePaneId: (id: string) => void;
  onAddPane: (title: string) => void;
  onAddTask: (paneId: string, content: string) => void;
  onOpenSyncModal: () => void;
  isSyncEnabled: boolean;
  isConnected: boolean;
}

// ==========================================
// ALL MODES: Return null across all modes.
// In Regular & Passthrough, only floating text cards render (NVIDIA overlay isolation parity).
// In Active Mode, Canvas.tsx renders the rich management navigation controls right inside the top header!
// ==========================================
export const ControlPanel: React.FC<ControlPanelProps> = () => {
  return null;
};
