import React from "react";
import { X, Type, Monitor, Sparkles } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
  globalFont: string;
  setGlobalFont: (val: string) => void;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
  experimentalDockFloat: boolean;
  setExperimentalDockFloat: (val: boolean) => void;
  overlayScale: number;
  setOverlayScale: (val: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  globalFont,
  setGlobalFont,
  activeTheme,
  setActiveTheme,
  experimentalDockFloat,
  setExperimentalDockFloat,
  overlayScale,
  setOverlayScale,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ 
          backgroundColor: activeTheme === 'minimalist' ? '#0a0a0a' : 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)'
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/50">
          <h2 className="text-xl font-marker text-white tracking-wide">Preferences</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
          
          {/* Typography */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--theme-accent)] text-sm tracking-wider">
              <Type size={16} />
              <span>Font</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setGlobalFont("font-marker")} className={`p-3 rounded-xl border text-left transition-all ${globalFont === "font-marker" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-accent)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                <div className="font-marker text-xl">Caveat</div>
              </button>
              <button onClick={() => setGlobalFont("font-serif-app")} className={`p-3 rounded-xl border text-left transition-all ${globalFont === "font-serif-app" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-accent)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                <div className="font-serif-app text-lg">EB Garamond</div>
              </button>
              <button onClick={() => setGlobalFont("font-hand1")} className={`p-3 rounded-xl border text-left transition-all ${globalFont === "font-hand1" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-accent)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                <div className="font-hand1 text-xl">Give You Glory</div>
              </button>
              <button onClick={() => setGlobalFont("font-hand2")} className={`p-3 rounded-xl border text-left transition-all ${globalFont === "font-hand2" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-accent)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                <div className="font-hand2 text-xl">Patrick Hand</div>
              </button>
            </div>
          </div>

          {/* Unified Visual Theme */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--theme-accent)] text-sm tracking-wider">
              <Monitor size={16} />
              <span>Theme</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => setActiveTheme("minimalist")} className={`p-3 rounded-xl border text-left transition-all ${activeTheme === "minimalist" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Minimalist
              </button>
              <button onClick={() => setActiveTheme("forest")} className={`p-3 rounded-xl border text-left transition-all ${activeTheme === "forest" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Forest
              </button>
              <button onClick={() => setActiveTheme("cosmic")} className={`p-3 rounded-xl border text-left transition-all ${activeTheme === "cosmic" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Cosmic
              </button>
              <button onClick={() => setActiveTheme("mahogany")} className={`p-3 rounded-xl border text-left transition-all ${activeTheme === "mahogany" ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Mahogany
              </button>
            </div>
          </div>

          {/* Regular Mode Scale */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--theme-accent)] text-sm tracking-wider">
              <Monitor size={16} />
              <span>Overlay Scale</span>
            </div>
            <div className="text-neutral-400 text-sm">Adjust the size of the taskboard when pinned to the desktop.</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setOverlayScale(0.65)} className={`p-3 rounded-xl border text-center transition-all ${overlayScale === 0.65 ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Compact
              </button>
              <button onClick={() => setOverlayScale(0.85)} className={`p-3 rounded-xl border text-center transition-all ${overlayScale === 0.85 ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Standard
              </button>
              <button onClick={() => setOverlayScale(1.0)} className={`p-3 rounded-xl border text-center transition-all ${overlayScale === 1.0 ? "bg-[var(--theme-accent-bg)] border-[var(--theme-accent)]/50 text-[var(--theme-ink)]" : "bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10"}`}>
                Large
              </button>
            </div>
          </div>

          {/* Experimental Features */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--theme-accent)] text-sm tracking-wider">
              <Sparkles size={16} />
              <span>Experimental</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <div className="text-white text-base">Float above macOS Dock</div>
                <div className="text-neutral-400 text-sm mt-1">Forces the dashboard to float entirely above the dock</div>
              </div>
              <button
                onClick={() => setExperimentalDockFloat(!experimentalDockFloat)}
                className={`w-12 h-6 rounded-full transition-colors relative ${experimentalDockFloat ? "bg-[var(--theme-accent)]" : "bg-neutral-700"}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${experimentalDockFloat ? "translate-x-6" : "translate-x-0"} ${activeTheme === 'minimalist' && experimentalDockFloat ? "bg-black" : "bg-white"}`} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
