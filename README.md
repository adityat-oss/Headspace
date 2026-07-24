# Headspace

This is a completely transparent, frameless desktop whiteboard and task overlay. It pins itself directly to the desktop wallpaper layer so it stays out of the way of your regular apps and doesn't clutter up the Cmd+Tab switcher.

It basically has two modes:
- **Regular Mode:** Acts like an overlay. Zero backgrounds, zero pills, zero boxes. 
- **Dashboard Mode:** Press `Cmd + Shift + B` (or `Ctrl + Shift + B` on Windows) to force it into dashboard. This brings up a hub where you can manage your boards, change settings, and make new taskboards.

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

## Installation & Troubleshooting

Because this is a powerful open-source app and is not cryptographically signed by a paid Apple/Microsoft developer account, your operating system will try to block it from running the first time you download it.

Here is how to safely bypass the security blocks:

### Mac (Apple Silicon & Intel)
When you download the `.app` file, macOS Gatekeeper will falsely claim the app is "damaged and should be moved to trash" because it is unsigned.
1. Move the `Headspace.app` file into your Mac's **Applications** folder.
2. Open your Mac's **Terminal**.
3. Copy and paste this exact command to remove Apple's quarantine flag:
   ```bash
   xattr -cr /Applications/Headspace.app
   ```
4. Double-click the app in your Applications folder and it will launch perfectly.

### Windows
When you run the `.exe` or `.msi` installer, Windows SmartScreen will pop up a blue box saying "Windows protected your PC".
1. Click **More info** on the blue popup.
2. Click **Run anyway**.
