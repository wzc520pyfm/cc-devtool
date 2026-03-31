use std::net::TcpStream;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

fn wait_for_server(port: u16, timeout_ms: u64) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let interval = std::time::Duration::from_millis(200);
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

    while std::time::Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &addr.parse().unwrap(),
            std::time::Duration::from_secs(1),
        )
        .is_ok()
        {
            return true;
        }
        std::thread::sleep(interval);
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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

            log::info!("cc-devtool server sidecar spawned, waiting for ready...");

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if wait_for_server(4173, 15000) {
                    log::info!("cc-devtool server is ready");
                } else {
                    log::warn!("cc-devtool server did not become ready within 15s");
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
