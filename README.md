# Headspace (Ambient Board)

This is a completely transparent, frameless desktop whiteboard and task overlay. It pins itself directly to the desktop wallpaper layer so it stays out of the way of your regular apps and doesn't clutter up the Cmd+Tab switcher.

It basically has two modes:
- **Regular Mode:** Acts like an NVIDIA overlay. Zero backgrounds, zero pills, zero boxes. Just pure text floating on your screen that you can click right through.
- **Dashboard Mode:** Press `Cmd + Shift + B` (or `Ctrl + Shift + B` on Windows) to force it into dashboard. This brings up a frosted-glass hub where you can manage your boards, change settings, and actually edit the tasks.

### How it Works Under the Hood
It's built with Tauri 2.0 (Rust) for the backend and React/Tailwind for the UI.
Everything you type saves instantly to a local SQLite database on your machine so it works perfectly offline. There's also an optional sync server if you want to connect multiple devices together over WebSockets.

### How to Run It
Make sure you have Node and Rust installed.

To test it locally:
```bash
npm install
npm run tauri dev
```

To compile the actual release binary (no localhost or DevTools):
```bash
npm run tauri build
```
