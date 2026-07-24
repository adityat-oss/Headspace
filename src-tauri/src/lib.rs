use std::sync::Mutex;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri::async_runtime::JoinHandle;

mod window_pinning;

struct AppState {
    pass_through: Mutex<bool>,
    sleep_timer: Mutex<Option<JoinHandle<()>>>,
}

#[tauri::command]
fn set_pass_through(
    window: tauri::WebviewWindow,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    {
        let mut pass = state.pass_through.lock().unwrap();
        *pass = enabled;
    }
    window_pinning::prepare_overlay_window(&window, enabled);
    Ok(())
}

#[tauri::command]
fn set_tray_icon(
    app_handle: tauri::AppHandle,
    theme: String,
) -> Result<(), String> {
    if let Some(tray) = app_handle.tray_by_id("main") {
        if theme == "regular" {
            let img_bytes = include_bytes!("../icons/32x32.png");
            let img = image::load_from_memory(img_bytes).unwrap().into_rgba8();
            let (width, height) = img.dimensions();
            let tray_icon = tauri::image::Image::new_owned(img.into_raw(), width, height);
            let _ = tray.set_icon(Some(tray_icon));
            let _ = tray.set_icon_as_template(false);
        } else {
            let img_bytes = include_bytes!("../icons/tray-icon.png");
            let img = image::load_from_memory(img_bytes).unwrap().into_rgba8();
            let (width, height) = img.dimensions();
            let tray_icon = tauri::image::Image::new_owned(img.into_raw(), width, height);
            let _ = tray.set_icon(Some(tray_icon));
            let _ = tray.set_icon_as_template(true);
        }
    }
    Ok(())
}

#[tauri::command]
fn force_window_level(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(dash_win) = app_handle.get_webview_window("dashboard") {
        #[cfg(target_os = "macos")]
        {
            use cocoa::appkit::NSWindow;
            if let Ok(ns_window) = dash_win.ns_window() {
                let ns_window = ns_window as *mut objc::runtime::Object;
                unsafe {
                    ns_window.setLevel_(22);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn set_app_mode_native(
    window: tauri::WebviewWindow,
    mode: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let app_handle = window.app_handle();

    if mode == "active" {
        {
            let mut pass = state.pass_through.lock().unwrap();
            *pass = false;
            
            let mut timer_guard = state.sleep_timer.lock().unwrap();
            if let Some(timer) = timer_guard.take() {
                timer.abort();
                let _ = app_handle.emit("deep-sleep-exit", ());
            }
        }
        window_pinning::enter_active_mode(app_handle);
    } else if mode == "regular" {
        {
            let mut pass = state.pass_through.lock().unwrap();
            *pass = false;

            let mut timer_guard = state.sleep_timer.lock().unwrap();
            if let Some(timer) = timer_guard.take() {
                timer.abort();
                let _ = app_handle.emit("deep-sleep-exit", ());
            }
        }
        if window_pinning::is_dashboard_visible(app_handle) {
            window_pinning::exit_active_mode(app_handle);
        } else if let Some(main_win) = app_handle.get_webview_window("main") {
            let _ = main_win.show();
            window_pinning::prepare_overlay_window(&main_win, false);
            let _ = app_handle.emit(
                "mode-changed",
                serde_json::json!({
                    "appMode": "regular",
                    "isInteractive": true
                }),
            );
        }
    } else {
        {
            let mut pass = state.pass_through.lock().unwrap();
            *pass = true;
            
            // Start the deep sleep countdown timer
            let app_handle_clone = app_handle.clone();
            let handle = tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(300)).await;
                let _ = app_handle_clone.emit("deep-sleep-enter", ());
                if let Some(main_win) = app_handle_clone.get_webview_window("main") {
                    let _ = main_win.hide();
                }
            });
            *state.sleep_timer.lock().unwrap() = Some(handle);
        }
        if window_pinning::is_dashboard_visible(app_handle) {
            window_pinning::hide_dashboard(app_handle);
        }
        if let Some(main_win) = app_handle.get_webview_window("main") {
            let _ = main_win.show();
            window_pinning::prepare_overlay_window(&main_win, true);
        }
        let _ = app_handle.emit(
            "mode-changed",
            serde_json::json!({
                "appMode": "passthrough",
                "isInteractive": false
            }),
        );
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "macos")]
    let modifiers = Modifiers::SUPER | Modifiers::SHIFT;
    #[cfg(not(target_os = "macos"))]
    let modifiers = Modifiers::CONTROL | Modifiers::SHIFT;

    let toggle_shortcut = Shortcut::new(Some(modifiers), Code::Space);
    let hide_shortcut = Shortcut::new(Some(modifiers), Code::KeyB);

    tauri::Builder::default()
        .manage(AppState {
            pass_through: Mutex::new(false),
            sleep_timer: Mutex::new(None),
        })
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::Focused(true) | WindowEvent::ScaleFactorChanged { .. } => {
                    let app = window.app_handle();
                    let passthrough = app
                        .state::<AppState>()
                        .pass_through
                        .lock()
                        .map(|p| *p)
                        .unwrap_or(false);
                    if let Some(main_win) = app.get_webview_window("main") {
                        if main_win.is_visible().unwrap_or(false) {
                            window_pinning::refresh_overlay_pinning(&main_win, passthrough);
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let _ = window.set_size(*monitor.size());
                    let _ = window.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition { x: 0, y: 0 },
                    ));
                }
                window_pinning::prepare_overlay_window(&window, false);

                #[cfg(debug_assertions)]
                {

                }
            }

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            #[cfg(target_os = "macos")]
            let tooltip_text = "Headspace - Cmd+Shift+Space (Toggle Overlay) | Cmd+Shift+B (Active Hub)";
            #[cfg(not(target_os = "macos"))]
            let tooltip_text = "Headspace - Ctrl+Shift+Space (Toggle Overlay) | Ctrl+Shift+B (Active Hub)";

            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            let dashboard_i = MenuItem::with_id(app, "active", "Dashboard Mode", true, None::<&str>)?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let regular_i = MenuItem::with_id(app, "regular", "Desktop Overlay", true, None::<&str>)?;
            let passthrough_i = MenuItem::with_id(app, "passthrough", "Hidden (Background)", true, None::<&str>)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let restart_i = MenuItem::with_id(app, "restart", "Relaunch App", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Headspace", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&dashboard_i, &separator1, &regular_i, &passthrough_i, &separator2, &restart_i, &quit_i])?;

            let img_bytes = include_bytes!("../icons/tray-icon.png");
            let img = image::load_from_memory(img_bytes).unwrap().into_rgba8();
            let (width, height) = img.dimensions();
            let tray_icon = tauri::image::Image::new_owned(img.into_raw(), width, height);

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip(tooltip_text)
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "active" | "regular" | "passthrough" => {
                            let mode = event.id.as_ref();
                            if mode == "active" {
                                {
                                    let state = app.state::<AppState>();
                                    let mut pass = state.pass_through.lock().unwrap();
                                    *pass = false;
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                        let _ = app.emit("deep-sleep-exit", ());
                                    }
                                }
                                window_pinning::enter_active_mode(app);
                            } else if mode == "regular" {
                                {
                                    let state = app.state::<AppState>();
                                    let mut pass = state.pass_through.lock().unwrap();
                                    *pass = false;
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                        let _ = app.emit("deep-sleep-exit", ());
                                    }
                                }
                                window_pinning::exit_active_mode(app);
                                if let Some(main_win) = app.get_webview_window("main") {
                                    let _ = main_win.show();
                                    window_pinning::prepare_overlay_window(&main_win, false);
                                }
                            } else if mode == "passthrough" {
                                {
                                    let state = app.state::<AppState>();
                                    let mut pass = state.pass_through.lock().unwrap();
                                    *pass = true;
                                    let app_clone = app.clone();
                                    let handle = tauri::async_runtime::spawn(async move {
                                        tokio::time::sleep(std::time::Duration::from_secs(300)).await;
                                        let _ = app_clone.emit("deep-sleep-enter", ());
                                        if let Some(main_win) = app_clone.get_webview_window("main") {
                                            let _ = main_win.hide();
                                        }
                                    });
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                    }
                                    *timer_guard = Some(handle);
                                }
                                window_pinning::exit_active_mode(app);
                                if let Some(main_win) = app.get_webview_window("main") {
                                    let _ = main_win.show();
                                    window_pinning::prepare_overlay_window(&main_win, true);
                                }
                            }

                            if let Some(main_win) = app.get_webview_window("main") {
                                let _ = main_win.emit("mode-changed", serde_json::json!({
                                    "appMode": mode
                                }));
                            }
                        }
                        "restart" => {
                            app.restart();
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            let toggle_shortcut_clone = toggle_shortcut;
            let hide_shortcut_clone = hide_shortcut;

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }

                        let dash_visible = window_pinning::is_dashboard_visible(app);

                        if shortcut == &toggle_shortcut_clone {
                            if dash_visible {
                                {
                                    let state = app.state::<AppState>();
                                    let mut pass = state.pass_through.lock().unwrap();
                                    *pass = false;
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                    }
                                }
                                window_pinning::exit_active_mode(app);
                                return;
                            }

                            let new_pass = {
                                let state = app.state::<AppState>();
                                let mut pass = state.pass_through.lock().unwrap();
                                *pass = !*pass;
                                
                                if *pass {
                                    // Start deep sleep timer
                                    let app_handle_clone = app.clone();
                                    let handle = tauri::async_runtime::spawn(async move {
                                        tokio::time::sleep(std::time::Duration::from_secs(300)).await;
                                        let _ = app_handle_clone.emit("deep-sleep-enter", ());
                                        if let Some(main_win) = app_handle_clone.get_webview_window("main") {
                                            let _ = main_win.hide();
                                        }
                                    });
                                    *state.sleep_timer.lock().unwrap() = Some(handle);
                                } else {
                                    // Abort deep sleep timer and wake up
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                    }
                                    let _ = app.emit("deep-sleep-exit", ());
                                }

                                *pass
                            };

                            if let Some(main_win) = app.get_webview_window("main") {
                                let _ = main_win.show();
                                window_pinning::prepare_overlay_window(&main_win, new_pass);
                            }

                            if new_pass {
                                let _ = app.emit(
                                    "mode-changed",
                                    serde_json::json!({
                                        "appMode": "passthrough",
                                        "isInteractive": false
                                    }),
                                );
                            } else {
                                let _ = app.emit(
                                    "mode-changed",
                                    serde_json::json!({
                                        "appMode": "regular",
                                        "isInteractive": true
                                    }),
                                );
                            }
                        } else if shortcut == &hide_shortcut_clone {
                            if dash_visible {
                                {
                                    let state = app.state::<AppState>();
                                    let mut pass = state.pass_through.lock().unwrap();
                                    *pass = false;
                                    let mut timer_guard = state.sleep_timer.lock().unwrap();
                                    if let Some(timer) = timer_guard.take() {
                                        timer.abort();
                                        let _ = app.emit("deep-sleep-exit", ());
                                    }
                                }
                                window_pinning::exit_active_mode(app);
                                return;
                            }

                            {
                                let state = app.state::<AppState>();
                                let mut pass = state.pass_through.lock().unwrap();
                                *pass = false;
                                let mut timer_guard = state.sleep_timer.lock().unwrap();
                                if let Some(timer) = timer_guard.take() {
                                    timer.abort();
                                    let _ = app.emit("deep-sleep-exit", ());
                                }
                            }
                            window_pinning::enter_active_mode(app);
                        }
                    })
                    .build(),
            )?;

            let _ = app.handle().global_shortcut().register(toggle_shortcut);
            let _ = app.handle().global_shortcut().register(hide_shortcut);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_pass_through, set_app_mode_native, set_tray_icon, force_window_level])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

