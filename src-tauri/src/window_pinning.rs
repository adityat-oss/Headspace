use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

pub fn pin_window_to_desktop(window: &WebviewWindow) {
    prepare_overlay_window(window, true);
}

pub fn refresh_overlay_pinning(window: &WebviewWindow, passthrough: bool) {
    let _ = window.set_ignore_cursor_events(passthrough);
    let _ = window.set_always_on_top(true);
    let _ = window.set_visible_on_all_workspaces(true);
    apply_fullscreen_auxiliary(window);
}

pub fn prepare_overlay_window(window: &WebviewWindow, passthrough: bool) {
    let _ = window.set_ignore_cursor_events(passthrough);
    let _ = window.set_always_on_top(true);
    let _ = window.set_visible_on_all_workspaces(true);
    apply_fullscreen_auxiliary(window);
    let _ = window.show();
    if !passthrough {
        let _ = window.set_focus();
    }
}

pub fn order_front_regardless(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn set_window_passthrough(window: &WebviewWindow, passthrough: bool) {
    prepare_overlay_window(window, passthrough);
}

pub fn is_ambient_board_frontmost(app: &AppHandle) -> bool {
    if let Some(main) = app.get_webview_window("main") {
        if main.is_focused().unwrap_or(false) {
            return true;
        }
    }
    if let Some(dash) = app.get_webview_window("dashboard") {
        if dash.is_focused().unwrap_or(false) {
            return true;
        }
    }
    false
}

pub fn hide_dashboard(app: &AppHandle) {
    if let Some(dash_win) = app.get_webview_window("dashboard") {
        let _ = dash_win.hide();
    }
}

pub fn enter_active_mode(app: &AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }

    if let Some(dash_win) = app.get_webview_window("dashboard") {
        let _ = dash_win.unminimize();
        
        if let Ok(Some(monitor)) = dash_win.current_monitor() {
            let _ = dash_win.set_size(*monitor.size());
            let _ = dash_win.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition { x: 0, y: 0 },
            ));
        }
        
        let _ = dash_win.set_always_on_top(true);
        let _ = dash_win.show();
        let _ = dash_win.set_focus();

        #[cfg(target_os = "macos")]
        {
            use cocoa::appkit::NSWindow;
            if let Ok(ns_window) = dash_win.ns_window() {
                let ns_window = ns_window as *mut objc::runtime::Object;
                unsafe {
                    ns_window.setLevel_(22); // 20 is Dock, 24 is MenuBar
                }
            }
        }
    }

    let _ = app.emit(
        "mode-changed",
        serde_json::json!({
            "appMode": "active",
            "isInteractive": true
        }),
    );
}

pub fn exit_active_mode(app: &AppHandle) {
    hide_dashboard(app);

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        prepare_overlay_window(&main_win, false);
    }

    let _ = app.emit(
        "mode-changed",
        serde_json::json!({
            "appMode": "regular",
            "isInteractive": true
        }),
    );
}

pub fn is_dashboard_visible(app: &AppHandle) -> bool {
    app.get_webview_window("dashboard")
        .map(|d| d.is_visible().unwrap_or(false))
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
pub fn apply_fullscreen_auxiliary(window: &WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;

    if let Ok(ns_window_ptr) = window.ns_window() {
        let ns_window = ns_window_ptr as id;
        unsafe {
            let mut behavior = ns_window.collectionBehavior();
            behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;
            behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces;
            ns_window.setCollectionBehavior_(behavior);
            
            // Set window level to 25 to ensure it floats over fullscreen applications
            ns_window.setLevel_(25);
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_fullscreen_auxiliary(_window: &WebviewWindow) {}
