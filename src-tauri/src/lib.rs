//! Desktop shell for Subscription Payments (Windows and Linux).
//!
//! The whole app is the same web UI as the PWA and the Android build. This
//! file only adds what a desktop app needs around it: a tray icon so reminders
//! keep arriving while the window is closed, a quiet start at login, one
//! instance at a time, and file writing for backups and exports.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Close hides the window to the tray instead of quitting (a user setting).
static KEEP_IN_TRAY: AtomicBool = AtomicBool::new(true);
/// Set when "Quit" is chosen, so the close handler lets the app exit.
static QUITTING: AtomicBool = AtomicBool::new(false);

const BACKUP_DIR: &str = "SubscriptionPayments";
const BACKUP_PREFIX: &str = "subscriptions-backup-";
/// Passed by the login item so the app starts in the tray, not on screen.
const HIDDEN_ARG: &str = "--hidden";

struct TrayItems {
    open: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

struct TrayState(Mutex<Option<TrayItems>>);

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// The user's Documents folder. Some Linux setups have no XDG user dirs
/// configured; fall back to ~/Documents so the path matches what the app says.
fn documents_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .document_dir()
        .or_else(|_| app.path().home_dir().map(|home| home.join("Documents")))
        .map_err(|e| e.to_string())
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(documents_dir(app)?.join(BACKUP_DIR))
}

/// Backup file names come from the web side; accept only the expected shape
/// so nothing can be written outside the backup folder.
fn valid_backup_name(name: &str) -> bool {
    name.starts_with(BACKUP_PREFIX)
        && name.ends_with(".json")
        && name.len() < 120
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

/// Writes an automatic backup into Documents/SubscriptionPayments and keeps
/// only the newest `keep` copies. Returns the folder path.
#[tauri::command]
fn write_backup(
    app: AppHandle,
    name: String,
    contents: String,
    keep: usize,
) -> Result<String, String> {
    if !valid_backup_name(&name) {
        return Err("invalid backup name".into());
    }
    let dir = backup_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(&name), contents).map_err(|e| e.to_string())?;

    // Names carry the date, so sorting them sorts by age.
    let mut copies: Vec<PathBuf> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(valid_backup_name)
        })
        .collect();
    copies.sort();
    copies.reverse();
    for old in copies.into_iter().skip(keep.max(1)) {
        let _ = std::fs::remove_file(old);
    }
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_backup_folder(app: AppHandle) -> Result<(), String> {
    let dir = backup_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// "Save as…" for exports. The path is chosen in the system dialog here, in
/// Rust, so the web side never names a location on disk.
/// Returns false when the user cancels.
#[tauri::command]
async fn save_file(app: AppHandle, name: String, contents: String) -> Result<bool, String> {
    let file_name = PathBuf::from(&name)
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_owned)
        .ok_or("invalid file name")?;
    let ext = PathBuf::from(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_owned();
    let start = documents_dir(&app).ok().filter(|d| d.is_dir());

    let mut dialog = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter(ext.to_uppercase(), &[ext.as_str()]);
    if let Some(dir) = start {
        dialog = dialog.set_directory(dir);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn set_keep_in_tray(enabled: bool) {
    KEEP_IN_TRAY.store(enabled, Ordering::Relaxed);
}

/// Tray menu labels follow the language chosen in the app.
#[tauri::command]
fn set_tray_labels(
    state: tauri::State<'_, TrayState>,
    open: String,
    quit: String,
) -> Result<(), String> {
    if let Some(items) = state.0.lock().map_err(|e| e.to_string())?.as_ref() {
        items.open.set_text(open).map_err(|e| e.to_string())?;
        items.quit.set_text(quit).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Subscription Payments")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "quit" => {
                QUITTING.store(true, Ordering::Relaxed);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    app.state::<TrayState>()
        .0
        .lock()
        .expect("tray state")
        .replace(TrayItems { open, quit });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Must come first: a second launch focuses the running app instead.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                show_main(app)
            }))
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![HIDDEN_ARG]),
            ));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(TrayState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            write_backup,
            open_backup_folder,
            save_file,
            set_keep_in_tray,
            set_tray_labels
        ])
        .setup(|app| {
            let handle = app.handle();
            // Without a tray (some Linux desktops) closing must really quit,
            // or the app would keep running with no way to reach it.
            if let Err(err) = build_tray(handle) {
                eprintln!("tray unavailable: {err}");
                KEEP_IN_TRAY.store(false, Ordering::Relaxed);
            }
            let started_hidden = std::env::args().any(|a| a == HIDDEN_ARG);
            if !started_hidden {
                show_main(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if KEEP_IN_TRAY.load(Ordering::Relaxed) && !QUITTING.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
