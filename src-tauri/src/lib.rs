mod chat;
mod llm;
mod mcp_client;
mod workspace;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(mcp_client::McpConnections::new(Mutex::new(HashMap::new())))
        .manage(chat::ChatSessions::new(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace::list_workspaces,
            workspace::create_workspace,
            workspace::update_workspace,
            workspace::delete_workspace,
            workspace::get_workspace,
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
