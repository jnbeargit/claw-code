mod chat;
mod engine;
mod mcp_client;
mod workspace;

use chat::{chat_clear_history, chat_get_history, chat_list_sessions, chat_send_message, ChatSessions};
use mcp_client::{
    mcp_call_tool, mcp_connect, mcp_disconnect, mcp_list_tools, McpConnections,
};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use workspace::{
    create_workspace, delete_workspace, get_workspace, import_mcpb_bundle,
    list_workspaces, peek_mcpb_bundle, update_workspace,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize shared state
            app.manage(Arc::new(Mutex::new(HashMap::new())) as ChatSessions);
            app.manage(Arc::new(Mutex::new(HashMap::new())) as McpConnections);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            list_workspaces,
            create_workspace,
            update_workspace,
            delete_workspace,
            get_workspace,
            import_mcpb_bundle,
            peek_mcpb_bundle,
            // Chat commands
            chat_send_message,
            chat_get_history,
            chat_clear_history,
            chat_list_sessions,
            // MCP commands
            mcp_connect,
            mcp_disconnect,
            mcp_list_tools,
            mcp_call_tool,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
