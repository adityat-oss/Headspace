import React, { useState } from "react";
import { X, ShieldCheck, Wifi, WifiOff, Power, Copy, Check, Share2, Link2, KeyRound, ArrowRight, RefreshCw } from "lucide-react";

interface SyncModalProps {
  globalFont: string;
  isOpen: boolean;
  onClose: () => void;
  syncUrl: string;
  syncToken: string;
  isSyncEnabled: boolean;
  isConnected: boolean;
  onSaveAndToggle: (url: string, token: string, enabled: boolean) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  globalFont,
  isOpen,
  onClose,
  syncUrl,
  syncToken,
  isSyncEnabled,
  isConnected,
  onSaveAndToggle,
}) => {
  const [url, setUrl] = useState(syncUrl);
  const [token, setToken] = useState(syncToken);
  const [enabled, setEnabled] = useState(isSyncEnabled);
  const [activeTab, setActiveTab] = useState<"host" | "join">("host");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(token);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAndToggle(url, token, enabled);
    onClose();
  };

  const handleRegenerateKeys = () => {
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
    
    const newUrl = `wss://relay.ambientboard.io/sync/${generateId().split('-')[0]}`;
    const newToken = generateId().replace(/-/g, '').substring(0, 16);
    setUrl(newUrl);
    setToken(newToken);
    onSaveAndToggle(newUrl, newToken, enabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto p-4">
      <div 
        className="w-full max-w-lg border border-white/15 rounded-3xl p-6 shadow-2xl shadow-black flex flex-col gap-5 bg-[var(--theme-accent-bg)]"
        style={{ 
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)'
        }}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            {enabled && isConnected ? (
              <Wifi className="text-[var(--theme-accent)] animate-pulse" size={22} />
            ) : (
              <WifiOff className="text-neutral-400" size={22} />
            )}
            <div>
              <h3 className="${globalFont} text-2xl text-white tracking-wide">
                Cloud Sync
              </h3>
              <p className="font-mono text-xs text-neutral-400">
                Keep taskboards perfectly synced across devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Master Power Toggle */}
        <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Power size={20} className={enabled ? "text-[var(--theme-accent)]" : "text-neutral-500"} />
            <div className="flex flex-col">
              <span className="${globalFont} text-base text-neutral-200">
                Real-Time Synchronization
              </span>
              <span className="font-mono text-[11px] text-neutral-400">
                {enabled
                  ? isConnected
                    ? "🟢 Connected & Mirroring Tasks"
                    : "🟡 Connecting to Relay..."
                  : "⚪ Dormant (No background connections)"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              onSaveAndToggle(url, token, next);
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              enabled ? "bg-[var(--theme-accent)]" : "bg-neutral-700"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-black/50 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("host")}
            className={`flex-1 py-2 rounded-xl ${globalFont} text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "host"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] border border-[var(--theme-accent)]/40 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Share2 size={15} />
            <span>Your Sharing Link & Passkey</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-2 rounded-xl ${globalFont} text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "join"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] border border-[var(--theme-accent)]/40 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Link2 size={15} />
            <span>Connect to Another Device</span>
          </button>
        </div>

        {activeTab === "host" ? (
          /* TAB 1: Host & Share */
          <div className="flex flex-col gap-4 py-2 animate-fade-in">
            <p className="text-xs text-neutral-300 leading-relaxed font-mono">
              Share this link and passkey to mirror taskboards with another device.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Link2 size={13} className="text-[var(--theme-accent)]" />
                  Unique Sharing Relay Link
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-black/70 border border-white/15 rounded-xl text-neutral-200 font-mono text-xs truncate">
                    {url}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-200 flex items-center gap-1.5 ${globalFont} text-xs shrink-0 transition-all"
                  >
                    {copiedLink ? <Check size={14} className="text-[var(--theme-accent)]" /> : <Copy size={14} />}
                    <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <KeyRound size={13} className="text-[var(--theme-accent)]" />
                  Secure Passkey
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-black/70 border border-white/15 rounded-xl text-neutral-200 font-mono text-xs truncate group relative cursor-pointer">
                    <span className="blur-sm group-hover:blur-none transition-all duration-300 select-all">{token}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-200 flex items-center gap-1.5 ${globalFont} text-xs shrink-0 transition-all"
                  >
                    {copiedKey ? <Check size={14} className="text-[var(--theme-accent)]" /> : <Copy size={14} />}
                    <span>{copiedKey ? "Copied!" : "Copy Passkey"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[var(--theme-accent-bg)] border border-[var(--theme-accent)]/20 rounded-2xl p-3.5 mt-1">
              <div className="flex items-center gap-2 text-[var(--theme-accent)] ${globalFont} text-xs mb-1">
                <ShieldCheck size={14} />
                <span>End-to-End Encrypted Handshake</span>
              </div>
              <p className="text-[11px] text-[var(--theme-ink)] font-mono">
                E2E Encrypted. Only devices with the exact link and passkey can access your tasks.
              </p>
            </div>
          </div>
        ) : (
          /* TAB 2: Connect / Join */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2 animate-fade-in">
            <p className="text-xs text-neutral-300 leading-relaxed font-mono">
              Enter the link and passkey from your primary device to connect.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Peer Relay Link
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://localhost:8443 or wss://relay.ambientboard.io/sync"
                className="w-full px-4 py-3 bg-black/70 border border-white/15 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[var(--theme-accent)] transition-colors font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Secure Passkey
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter passkey..."
                className="w-full px-4 py-3 bg-black/70 border border-white/15 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[var(--theme-accent)] transition-colors font-mono text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/10 transition-colors ${globalFont} text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={() => setEnabled(true)}
                className="px-6 py-2.5 rounded-xl bg-[var(--theme-ink)] text-[var(--theme-accent-bg)] hover:opacity-80 font-bold shadow-lg shadow-[var(--theme-accent)]/20 transition-all flex items-center gap-2 ${globalFont} text-xs"
              >
                <span>Connect & Sync Now</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {activeTab === "host" && (
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleRegenerateKeys}
              className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 ${globalFont} text-xs flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={14} />
              <span>Regenerate Keys (1-Time Sync)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white ${globalFont} text-xs transition-all"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
