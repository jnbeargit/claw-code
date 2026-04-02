use runtime::{ConversationRuntime, Session};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tools::GlobalToolRegistry;
use uuid::Uuid;

use crate::engine::{create_permission_policy, TauriPermissionPrompter, TauriRuntimeClient, TauriToolExecutor};
use crate::mcp_client::McpConnections;
use crate::workspace;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub tool_calls: Option<Vec<ToolCallInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    pub id: String,
    pub name: String,
    pub input: Value,
    pub output: Option<Value>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub workspace_id: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: i64,
}

pub type ChatSessions = Arc<Mutex<HashMap<String, ChatSession>>>;

/// Get session directory for persistence
fn get_session_dir(workspace_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let session_dir = home
        .join(".norg-desktop")
        .join("sessions")
        .join(workspace_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    Ok(session_dir)
}

/// Save session to disk
fn save_session(workspace_id: &str, session_id: &str, session: &Session) -> Result<(), String> {
    let session_dir = get_session_dir(workspace_id)?;
    let session_path = session_dir.join(format!("{}.json", session_id));
    let json = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    std::fs::write(&session_path, json)
        .map_err(|e| format!("Failed to write session: {}", e))?;
    Ok(())
}

/// Load session from disk
fn load_session(workspace_id: &str, session_id: &str) -> Result<Option<Session>, String> {
    let session_dir = get_session_dir(workspace_id)?;
    let session_path = session_dir.join(format!("{}.json", session_id));
    
    if !session_path.exists() {
        return Ok(None);
    }

    let json = std::fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session: {}", e))?;
    let session: Session = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to deserialize session: {}", e))?;
    Ok(Some(session))
}

#[tauri::command]
pub async fn chat_send_message(
    app: AppHandle,
    workspace_id: String,
    session_id: String,
    message: String,
    sessions: State<'_, ChatSessions>,
    mcp_connections: State<'_, McpConnections>,
) -> Result<(), String> {
    eprintln!(
        "[CHAT] send_message called: workspace={}, session={}, msg_len={}",
        workspace_id,
        session_id,
        message.len()
    );

    // Get workspace config
    let ws = workspace::get_workspace(workspace_id.clone())
        .await
        .map_err(|e| {
            eprintln!("[CHAT] get_workspace failed: {}", e);
            e
        })?;
    eprintln!(
        "[CHAT] workspace loaded: name={}, provider={}, model={}",
        ws.name, ws.llm_provider, ws.llm_model
    );

    // Load or create session
    let session = load_session(&workspace_id, &session_id)?
        .unwrap_or_else(|| Session::new());

    // For now, skip system prompt loading - we'd need a workspace directory path
    // In production, we'd store workspace paths in the Workspace struct
    let system_prompt = Vec::new();

    // Get MCP client
    let mcp_client = {
        let conns = mcp_connections.lock().await;
        conns.get(&workspace_id).cloned()
    };

    // Get MCP tools for the LLM
    let mcp_tools = if let Some(ref client) = mcp_client {
        client.list_tools().await.unwrap_or_default()
    } else {
        Vec::new()
    };

    // Build global tool registry with built-in tools
    // MCP tools are handled separately by TauriToolExecutor
    let tool_registry = GlobalToolRegistry::builtin();

    // Build combined tool definitions for the LLM (built-in + MCP)
    let mut tool_definitions = tool_registry.definitions(None);
    for mcp_tool in &mcp_tools {
        tool_definitions.push(api::ToolDefinition {
            name: mcp_tool.name.clone(),
            description: mcp_tool.description.clone(),
            input_schema: mcp_tool.input_schema.clone(),
        });
    }

    // Create runtime client
    let runtime_client = TauriRuntimeClient::new(
        ws.llm_api_key.clone(),
        ws.llm_model.clone(),
        tool_definitions,
        app.clone(),
        session_id.clone(),
    )?;

    // Create tool executor
    let tool_executor = TauriToolExecutor::new(
        mcp_client,
        app.clone(),
        session_id.clone(),
    );

    // Create permission policy
    let permission_policy = create_permission_policy();
    let permission_prompter = TauriPermissionPrompter;

    // Create conversation runtime
    let mut runtime = ConversationRuntime::new(
        session,
        runtime_client,
        tool_executor,
        permission_policy,
        system_prompt,
    );

    // Run a single turn
    let mut prompter = permission_prompter;
    let summary = runtime
        .run_turn(&message, Some(&mut prompter))
        .map_err(|e| format!("Runtime error: {}", e))?;

    // Extract the updated session from the runtime
    let session = runtime.session().clone();

    // Save session to disk
    save_session(&workspace_id, &session_id, &session)?;

    // Extract final assistant text
    let assistant_text = summary
        .assistant_messages
        .last()
        .map(|msg| {
            msg.blocks
                .iter()
                .filter_map(|block| match block {
                    runtime::ContentBlock::Text { text } => Some(text.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    // Emit completion event
    let _ = app.emit(
        &format!("chat-complete:{}", session_id),
        &assistant_text,
    );

    // Update in-memory session state for chat_get_history
    {
        let mut sessions_map = sessions.lock().await;
        let chat_session = sessions_map
            .entry(session_id.clone())
            .or_insert_with(|| ChatSession {
                id: session_id.clone(),
                workspace_id: workspace_id.clone(),
                messages: Vec::new(),
                created_at: chrono::Utc::now().timestamp(),
            });

        // Add user message
        chat_session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: "user".to_string(),
            content: message,
            timestamp: chrono::Utc::now().timestamp(),
            tool_calls: None,
        });

        // Collect tool calls from summary
        let mut all_tool_calls: Vec<ToolCallInfo> = Vec::new();
        for msg in &summary.assistant_messages {
            for block in &msg.blocks {
                if let runtime::ContentBlock::ToolUse { id, name, input } = block {
                    // Find matching tool result
                    let output = summary.tool_results.iter().find_map(|result_msg| {
                        result_msg.blocks.iter().find_map(|result_block| {
                            if let runtime::ContentBlock::ToolResult {
                                tool_use_id,
                                output,
                                is_error,
                                ..
                            } = result_block
                            {
                                if tool_use_id == id {
                                    return Some((output.clone(), is_error));
                                }
                            }
                            None
                        })
                    });

                    let (output_val, status) = if let Some((out, is_error)) = output {
                        (
                            Some(serde_json::from_str(&out).unwrap_or(json!(out))),
                            if *is_error { "error" } else { "success" },
                        )
                    } else {
                        (None, "pending")
                    };

                    all_tool_calls.push(ToolCallInfo {
                        id: id.clone(),
                        name: name.clone(),
                        input: serde_json::from_str(&input).unwrap_or(json!({})),
                        output: output_val,
                        status: status.to_string(),
                    });
                }
            }
        }

        // Add assistant message
        chat_session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: "assistant".to_string(),
            content: assistant_text,
            timestamp: chrono::Utc::now().timestamp(),
            tool_calls: if all_tool_calls.is_empty() {
                None
            } else {
                Some(all_tool_calls)
            },
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn chat_get_history(
    session_id: String,
    sessions: State<'_, ChatSessions>,
) -> Result<Vec<ChatMessage>, String> {
    let sessions_map = sessions.lock().await;
    Ok(sessions_map
        .get(&session_id)
        .map(|s| s.messages.clone())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn chat_clear_history(
    workspace_id: String,
    session_id: String,
    sessions: State<'_, ChatSessions>,
) -> Result<(), String> {
    // Clear in-memory session
    let mut sessions_map = sessions.lock().await;
    if let Some(session) = sessions_map.get_mut(&session_id) {
        session.messages.clear();
    }

    // Delete session file
    let session_dir = get_session_dir(&workspace_id)?;
    let session_path = session_dir.join(format!("{}.json", session_id));
    if session_path.exists() {
        std::fs::remove_file(&session_path)
            .map_err(|e| format!("Failed to delete session file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn chat_list_sessions(
    workspace_id: String,
    sessions: State<'_, ChatSessions>,
) -> Result<Vec<ChatSession>, String> {
    let sessions_map = sessions.lock().await;
    Ok(sessions_map
        .values()
        .filter(|s| s.workspace_id == workspace_id)
        .cloned()
        .collect())
}
