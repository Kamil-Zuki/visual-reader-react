use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct AnkiConnectResponse {
    result: Option<serde_json::Value>,
    error: Option<String>,
}

/// Прокси AnkiConnect из Rust — обходит CORS WebView (tauri.localhost).
#[tauri::command]
fn anki_connect_request(base_url: String, body: String) -> Result<serde_json::Value, String> {
    let url = base_url.trim().trim_end_matches('/');
    if url.is_empty() {
        return Err("Пустой URL AnkiConnect".into());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .map_err(|e| format!("Не удалось достучаться до Anki: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("AnkiConnect HTTP {}", resp.status()));
    }

    let parsed: AnkiConnectResponse = resp
        .json()
        .map_err(|e| format!("Некорректный JSON от AnkiConnect: {e}"))?;

    if let Some(err) = parsed.error {
        return Err(err);
    }

    parsed
        .result
        .ok_or_else(|| "AnkiConnect вернул пустой result".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![anki_connect_request])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
