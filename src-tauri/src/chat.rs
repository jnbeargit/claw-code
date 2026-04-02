use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::llm::{create_provider, Message, StreamEvent, ToolUse};
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

const MAX_TOOL_LOOPS: usize = 20;

#[tauri::command]
pub async fn chat_send_message(
    app: AppHandle,
    workspace_id: String,
    session_id: String,
    message: String,
    sessions: State<'_, ChatSessions>,
    mcp_connections: State<'_, McpConnections>,
) -> Result<(), String> {
    // Get or create session + add user message
    {
        let mut sessions_map = sessions.lock().await;
        let session = sessions_map.entry(session_id.clone()).or_insert_with(|| ChatSession {
            id: session_id.clone(),
            workspace_id: workspace_id.clone(),
            messages: Vec::new(),
            created_at: chrono::Utc::now().timestamp(),
        });

        session.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: "user".to_string(),
            content: message.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            tool_calls: None,
        });
    }

    // Get workspace config
    let ws = workspace::get_workspace(workspace_id.clone()).await?;

    // Get MCP tools
    let tools = {
        let conns = mcp_connections.lock().await;
        match conns.get(&workspace_id) {
            Some(client) => client.list_tools().await.unwrap_or_default(),
            None => Vec::new(),
        }
    };

    // Create LLM provider
    let provider = create_provider(&ws.llm_provider, ws.llm_api_key.clone(), ws.llm_model.clone())?;

    // Build the LLM message history from the conversation
    // For Anthropic, we need to use content blocks for tool_use and tool_result
    let mut llm_messages: Vec<Message> = Vec::new();
    {
        let sessions_map = sessions.lock().await;
        if let Some(session) = sessions_map.get(&session_id) {
            for msg in &session.messages {
                llm_messages.push(Message::text(&msg.role, &msg.content));
            }
        }
    }

    let mut all_tool_calls: Vec<ToolCallInfo> = Vec::new();
    let mut full_assistant_text = String::new();

    // Tool use loop
    for _iteration in 0..MAX_TOOL_LOOPS {
        let sid = session_id.clone();
        let app_ref = app.clone();

        // Call LLM
        let (text, tool_uses) = provider
            .send_message(&llm_messages, &tools, &move |event| {
                match event {
                    StreamEvent::TextDelta(t) => {
                        let _ = app_ref.emit(&format!("chat-stream-delta:{}", sid), &t);
                    }
                    StreamEvent::ToolUse(tu) => {
                        let _ = app_ref.emit(
                            &format!("chat-tool-use:{}", sid),
                            json!({
                                "id": tu.id,
                                "name": tu.name,
                                "input": tu.input,
                                "status": "pending"
                            }),
                        );
                    }
                    StreamEvent::Complete(_) => {}
                    StreamEvent::Error(e) => {
                        let _ = app_ref.emit(&format!("chat-error:{}", sid), &e);
                    }
                }
            })
            .await?;

        full_assistant_text.push_str(&text);

        // No tool calls — we're done
        if tool_uses.is_empty() {
            let _ = app.emit(&format!("chat-complete:{}", session_id), &full_assistant_text);
            break;
        }

        // Build the assistant message with tool_use content blocks (Anthropic format)
        let mut assistant_content_blocks: Vec<Value> = Vec::new();
        if !text.is_empty() {
            assistant_content_blocks.push(json!({ "type": "text", "text": text }));
        }
        for tu in &tool_uses {
            assistant_content_blocks.push(Message::tool_use_block(&tu.id, &tu.name, &tu.input));
        }

        llm_messages.push(Message {
            role: "assistant".to_string(),
            content: Value::Array(assistant_content_blocks),
        });

        // Execute each tool call via MCP
        let mut tool_result_blocks: Vec<Value> = Vec::new();

        for tu in &tool_uses {
            let mut info = ToolCallInfo {
                id: tu.id.clone(),
                name: tu.name.clone(),
                input: tu.input.clone(),
                output: None,
                status: "pending".to_string(),
            };

            let result = {
                let conns = mcp_connections.lock().await;
                match conns.get(&workspace_id) {
                    Some(client) => client.call_tool(&tu.name, tu.input.clone()).await,
                    None => Err("MCP disconnected".to_string()),
                }
            };

            match result {
                Ok(result_val) => {
                    let result_text = if let Some(content) = result_val.get("content") {
                        if let Some(arr) = content.as_array() {
                            arr.iter()
                                .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
                                .collect::<Vec<_>>()
                                .join("\n")
                        } else {
                            serde_json::to_string(&result_val).unwrap_or_default()
                        }
                    } else {
                        serde_json::to_string(&result_val).unwrap_or_default()
                    };

                    info.output = Some(result_val.clone());
                    info.status = "success".to_string();

                    tool_result_blocks.push(Message::tool_result_block(&tu.id, &result_text));

                    let _ = app.emit(
                        &format!("chat-tool-result:{}", session_id),
                        json!({ "id": tu.id, "name": tu.name, "result": result_val, "status": "success" }),
                    );
                }
                Err(e) => {
                    info.output = Some(json!({ "error": e }));
                    info.status = "error".to_string();

                    tool_result_blocks.push(json!({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": format!("Error: {}", e),
                        "is_error": true
                    }));

                    let _ = app.emit(
                        &format!("chat-tool-result:{}", session_id),
                        json!({ "id": tu.id, "name": tu.name, "error": e, "status": "error" }),
                    );
                }
            }

            all_tool_calls.push(info);
        }

        // Add tool results as a user message with content blocks
        llm_messages.push(Message {
            role: "user".to_string(),
            content: Value::Array(tool_result_blocks),
        });
    }

    // Save the final assistant message to session history
    {
        let mut sessions_map = sessions.lock().await;
        if let Some(session) = sessions_map.get_mut(&session_id) {
            session.messages.push(ChatMessage {
                id: Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: full_assistant_text,
                timestamp: chrono::Utc::now().timestamp(),
                tool_calls: if all_tool_calls.is_empty() {
                    None
                } else {
                    Some(all_tool_calls)
                },
            });
        }
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
    session_id: String,
    sessions: State<'_, ChatSessions>,
) -> Result<(), String> {
    let mut sessions_map = sessions.lock().await;
    if let Some(session) = sessions_map.get_mut(&session_id) {
        session.messages.clear();
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
