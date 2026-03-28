use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let shell = app.shell();
            let sidecar = shell
                .sidecar("cc-devtool-server")
                .expect("failed to create sidecar command")
                .args(["serve", "--no-open"]);

            let (_rx, _child) = sidecar
                .spawn()
                .expect("failed to spawn cc-devtool server");

            log::info!("cc-devtool server sidecar spawned");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
