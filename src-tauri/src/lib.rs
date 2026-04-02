mod chat;
mod llm;
mod mcp_client;
mod workspace;

use std::collections::HashMap;
use serde_json::{json, Value};
use tokio::sync::Mutex;

#[tauri::command]
async fn list_models(provider: String, api_key: String) -> Result<Value, String> {
    let client = reqwest::Client::new();

    match provider.as_str() {
        "anthropic" => {
            let resp = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Failed to fetch models: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Anthropic API error {}: {}", status, body));
            }

            let body: Value = resp.json().await
                .map_err(|e| format!("Failed to parse models response: {}", e))?;

            let models: Vec<Value> = body
                .get("data")
                .and_then(|d| d.as_array())
                .map(|arr| {
                    arr.iter()
                        .map(|m| {
                            json!({
                                "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                "name": m.get("display_name").and_then(|v| v.as_str()).unwrap_or(
                                    m.get("id").and_then(|v| v.as_str()).unwrap_or("")
                                ),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();

            Ok(json!({ "models": models }))
        }
        "openai" => {
            let resp = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch models: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("OpenAI API error {}: {}", status, body));
            }

            let body: Value = resp.json().await
                .map_err(|e| format!("Failed to parse models response: {}", e))?;

            let models: Vec<Value> = body
                .get("data")
                .and_then(|d| d.as_array())
                .map(|arr| {
                    let mut filtered: Vec<Value> = arr
                        .iter()
                        .filter(|m| {
                            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            id.starts_with("gpt-") || id.starts_with("o1") || id.starts_with("o3")
                        })
                        .map(|m| {
                            json!({
                                "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                "name": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                            })
                        })
                        .collect();
                    filtered.sort_by(|a, b| {
                        let a_id = a.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let b_id = b.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        a_id.cmp(b_id)
                    });
                    filtered
                })
                .unwrap_or_default();

            Ok(json!({ "models": models }))
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(mcp_client::McpConnections::new(Mutex::new(HashMap::new())))
        .manage(chat::ChatSessions::new(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace::list_workspaces,
            workspace::create_workspace,
            workspace::update_workspace,
            workspace::delete_workspace,
            workspace::get_workspace,
            workspace::import_mcpb_bundle,
            workspace::peek_mcpb_bundle,
            // Model commands
            list_models,
            // MCP commands
            mcp_client::mcp_connect,
            mcp_client::mcp_disconnect,
            mcp_client::mcp_list_tools,
            mcp_client::mcp_call_tool,
            // Chat commands
            chat::chat_send_message,
            chat::chat_get_history,
            chat::chat_clear_history,
            chat::chat_list_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
