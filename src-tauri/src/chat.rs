use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::llm::{create_provider, Message, StreamEvent};
use crate::mcp_client::McpConnections;
use crate::workspace;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "user" or "assistant"
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
    pub status: String, // "pending", "success", "error"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub workspace_id: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: i64,
}

pub type ChatSessions = Arc<Mutex<HashMap<String, ChatSession>>>;

#[tauri::command]
pub async fn chat_send_message(
    app: AppHandle,
    workspace_id: String,
    session_id: String,
    message: String,
    sessions: State<'_, ChatSessions>,
    mcp_connections: State<'_, McpConnections>,
) -> Result<(), String> {
    // Get or create session
    let mut sessions_map = sessions.lock().await;
    let session = sessions_map.entry(session_id.clone()).or_insert_with(|| {
        ChatSession {
            id: session_id.clone(),
            workspace_id: workspace_id.clone(),
            messages: Vec::new(),
            created_at: chrono::Utc::now().timestamp(),
        }
    });
    
    // Add user message
    let user_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: message.clone(),
        timestamp: chrono::Utc::now().timestamp(),
        tool_calls: None,
    };
    session.messages.push(user_message);
    
    // Get workspace details
    let workspace = workspace::get_workspace(workspace_id.clone()).await?;
    
    // Get MCP tools
    let mcp_conns = mcp_connections.lock().await;
    let mcp_client = mcp_conns.get(&workspace_id).ok_or("MCP not connected")?;
    let tools = mcp_client.list_tools().await?;
    drop(mcp_conns);
    
    // Create LLM provider
    let provider = create_provider(
        &workspace.llm_provider,
        workspace.llm_api_key,
        workspace.llm_model,
    )?;
    
    // Prepare messages for LLM
    let mut llm_messages: Vec<Message> = session
        .messages
        .iter()
        .map(|m| Message {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();
    
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    
    drop(sessions_map); // Release lock before async operations
    
    // Start assistant message
    let assistant_message_id = Uuid::new_v4().to_string();
    let assistant_content = String::new();
    let mut tool_calls_info: Vec<ToolCallInfo> = Vec::new();
    
    // Tool use loop
    loop {
        let app_inner = app_clone.clone();
        let session_id_inner = session_id_clone.clone();
        
        // Send to LLM with streaming
        let tool_uses = provider
            .send_message(
                llm_messages.clone(),
                tools.clone(),
                Box::new(move |event| {
                    match event {
                        StreamEvent::TextDelta(text) => {
                            let _ = app_inner.emit(&format!("chat-stream-delta:{}", session_id_inner), text);
                        }
                        StreamEvent::ToolUse(tool_use) => {
                            let _ = app_inner.emit(&format!("chat-tool-use:{}", session_id_inner), tool_use);
                        }
                        StreamEvent::Complete => {
                            let _ = app_inner.emit(&format!("chat-complete:{}", session_id_inner), ());
                        }
                        StreamEvent::Error(error) => {
                            let _ = app_inner.emit(&format!("chat-error:{}", session_id_inner), error);
                        }
                    }
                }),
            )
            .await?;
        
        // If no tool uses, we're done
        if tool_uses.is_empty() {
            break;
        }
        
        // Execute tool calls
        let mcp_conns = mcp_connections.lock().await;
        let mcp_client = mcp_conns.get(&workspace_id).ok_or("MCP not connected")?;
        
        for tool_use in tool_uses {
            let tool_call_info = ToolCallInfo {
                id: tool_use.id.clone(),
                name: tool_use.name.clone(),
                input: tool_use.input.clone(),
                output: None,
                status: "pending".to_string(),
            };
            tool_calls_info.push(tool_call_info.clone());
            
            let _ = app.emit(
                &format!("chat-tool-use:{}", session_id),
                tool_call_info.clone(),
            );
            
            // Execute tool
            match mcp_client.call_tool(&tool_use.name, tool_use.input).await {
                Ok(result) => {
                    // Update tool call info
                    if let Some(info) = tool_calls_info.iter_mut().find(|t| t.id == tool_use.id) {
                        info.output = Some(result.clone());
                        info.status = "success".to_string();
                    }
                    
                    let _ = app.emit(
                        &format!("chat-tool-result:{}", session_id),
                        json!({
                            "id": tool_use.id,
                            "result": result
                        }),
                    );
                    
                    // Add tool result to conversation
                    llm_messages.push(Message {
                        role: "assistant".to_string(),
                        content: format!("Called tool: {}", tool_use.name),
                    });
                    llm_messages.push(Message {
                        role: "user".to_string(),
                        content: format!("Tool result: {}", result),
                    });
                }
                Err(e) => {
                    // Update tool call info
                    if let Some(info) = tool_calls_info.iter_mut().find(|t| t.id == tool_use.id) {
                        info.status = "error".to_string();
                        info.output = Some(serde_json::json!({ "error": e }));
                    }
                    
                    let _ = app.emit(
                        &format!("chat-error:{}", session_id),
                        format!("Tool call failed: {}", e),
                    );
                    
                    // Add error to conversation
                    llm_messages.push(Message {
                        role: "user".to_string(),
                        content: format!("Tool call failed: {}", e),
                    });
                }
            }
        }
        
        drop(mcp_conns);
    }
    
    // Save assistant message to session
    let mut sessions_map = sessions.lock().await;
    if let Some(session) = sessions_map.get_mut(&session_id) {
        session.messages.push(ChatMessage {
            id: assistant_message_id,
            role: "assistant".to_string(),
            content: assistant_content,
            timestamp: chrono::Utc::now().timestamp(),
            tool_calls: if tool_calls_info.is_empty() {
                None
            } else {
                Some(tool_calls_info)
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
    sessions_map
        .get(&session_id)
        .map(|s| s.messages.clone())
        .ok_or_else(|| "Session not found".to_string())
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
    let workspace_sessions: Vec<ChatSession> = sessions_map
        .values()
        .filter(|s| s.workspace_id == workspace_id)
        .cloned()
        .collect();
    Ok(workspace_sessions)
}
