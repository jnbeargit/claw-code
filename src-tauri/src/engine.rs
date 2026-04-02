use api::{
    AuthSource, ClawApiClient, ContentBlockDelta, InputContentBlock, InputMessage,
    MessageRequest, OutputContentBlock, StreamEvent, ToolChoice, ToolDefinition,
    ToolResultContentBlock,
};
use runtime::{
    ApiClient, ApiRequest, AssistantEvent, ContentBlock, PermissionMode,
    PermissionPolicy, PermissionPrompter, PermissionRequest, RuntimeError, ToolError,
    ToolExecutor,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::mcp_client::McpClient;

/// Custom ApiClient that emits Tauri events instead of writing to stdout
pub struct TauriRuntimeClient {
    client: ClawApiClient,
    model: String,
    tool_definitions: Vec<ToolDefinition>,
    app_handle: AppHandle,
    session_id: String,
    emit_output: bool,
}

impl TauriRuntimeClient {
    pub fn new(
        api_key: String,
        model: String,
        tool_definitions: Vec<ToolDefinition>,
        app_handle: AppHandle,
        session_id: String,
    ) -> Result<Self, String> {
        let client = ClawApiClient::from_auth(AuthSource::ApiKey(api_key));

        Ok(Self {
            client,
            model,
            tool_definitions,
            app_handle,
            session_id,
            emit_output: true,
        })
    }

    fn max_tokens_for_model(model: &str) -> usize {
        if model.contains("claude-3-5-sonnet") || model.contains("claude-sonnet-4") {
            8192
        } else if model.contains("claude-opus-4") {
            4096
        } else {
            4096
        }
    }

    fn convert_messages(messages: &[runtime::ConversationMessage]) -> Vec<InputMessage> {
        messages
            .iter()
            .map(|msg| InputMessage {
                role: match msg.role {
                    runtime::MessageRole::User => "user".to_string(),
                    runtime::MessageRole::Assistant => "assistant".to_string(),
                    runtime::MessageRole::System => "system".to_string(),
                    runtime::MessageRole::Tool => "tool".to_string(),
                },
                content: msg
                    .blocks
                    .iter()
                    .map(|block| match block {
                        ContentBlock::Text { text } => InputContentBlock::Text {
                            text: text.clone(),
                        },
                        ContentBlock::ToolUse { id, name, input } => InputContentBlock::ToolUse {
                            id: id.clone(),
                            name: name.clone(),
                            input: serde_json::from_str(input).unwrap_or(json!({})),
                        },
                        ContentBlock::ToolResult {
                            tool_use_id,
                            output,
                            is_error,
                            ..
                        } => InputContentBlock::ToolResult {
                            tool_use_id: tool_use_id.clone(),
                            content: vec![ToolResultContentBlock::Text {
                                text: output.clone(),
                            }],
                            is_error: *is_error,
                        },

                    })
                    .collect(),
            })
            .collect()
    }
}

impl ApiClient for TauriRuntimeClient {
    fn stream(&mut self, request: ApiRequest) -> Result<Vec<AssistantEvent>, RuntimeError> {
        let message_request = MessageRequest {
            model: self.model.clone(),
            max_tokens: Self::max_tokens_for_model(&self.model) as u32,
            messages: Self::convert_messages(&request.messages),
            system: (!request.system_prompt.is_empty())
                .then(|| request.system_prompt.join("\n\n")),
            tools: Some(self.tool_definitions.clone()),
            tool_choice: Some(ToolChoice::Auto),
            stream: true,
        };
        
        // Use block_in_place since we're called from within Tauri's async runtime
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
            let mut stream = self
                .client
                .stream_message(&message_request)
                .await
                .map_err(|error| RuntimeError::new(error.to_string()))?;

            let mut events = Vec::new();
            let mut pending_tool: Option<(String, String, String)> = None;
            let mut saw_stop = false;

            while let Some(event) = stream
                .next_event()
                .await
                .map_err(|error| RuntimeError::new(error.to_string()))?
            {
                match event {
                    StreamEvent::MessageStart(start) => {
                        for block in start.message.content {
                            if let OutputContentBlock::ToolUse { id, name, input } = block {
                                pending_tool = Some((id, name, serde_json::to_string(&input).unwrap_or_default()));
                            }
                        }
                    }
                    StreamEvent::ContentBlockStart(start) => {
                        if let OutputContentBlock::ToolUse { id, name, input } = start.content_block {
                            pending_tool = Some((id, name, serde_json::to_string(&input).unwrap_or_default()));
                        }
                    }
                    StreamEvent::ContentBlockDelta(delta) => match delta.delta {
                        ContentBlockDelta::TextDelta { text } => {
                            if !text.is_empty() && self.emit_output {
                                let _ = self.app_handle.emit(
                                    &format!("chat-stream-delta:{}", self.session_id),
                                    &text,
                                );
                                events.push(AssistantEvent::TextDelta(text));
                            }
                        }
                        ContentBlockDelta::InputJsonDelta { partial_json } => {
                            if let Some((_, _, input)) = &mut pending_tool {
                                input.push_str(&partial_json);
                            }
                        }
                        ContentBlockDelta::ThinkingDelta { thinking } => {
                            if !thinking.is_empty() && self.emit_output {
                                let _ = self.app_handle.emit(
                                    &format!("chat-thinking-delta:{}", self.session_id),
                                    &thinking,
                                );
                            }
                        }
                        ContentBlockDelta::SignatureDelta { .. } => {}
                    },
                    StreamEvent::ContentBlockStop(_) => {
                        if let Some((id, name, input)) = pending_tool.take() {
                            if self.emit_output {
                                let _ = self.app_handle.emit(
                                    &format!("chat-tool-use:{}", self.session_id),
                                    json!({
                                        "id": id,
                                        "name": name,
                                        "input": serde_json::from_str::<Value>(&input).unwrap_or(json!({})),
                                        "status": "pending"
                                    }),
                                );
                            }
                            events.push(AssistantEvent::ToolUse { id, name, input });
                        }
                    }
                    StreamEvent::MessageDelta(delta) => {
                        events.push(AssistantEvent::Usage(runtime::TokenUsage {
                            input_tokens: delta.usage.input_tokens,
                            output_tokens: delta.usage.output_tokens,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0,
                        }));
                    }
                    StreamEvent::MessageStop(_) => {
                        saw_stop = true;
                        events.push(AssistantEvent::MessageStop);
                    }
                }
            }

            if !saw_stop
                && events.iter().any(|event| {
                    matches!(event, AssistantEvent::TextDelta(text) if !text.is_empty())
                        || matches!(event, AssistantEvent::ToolUse { .. })
                })
            {
                events.push(AssistantEvent::MessageStop);
            }

            Ok(events)
        }) // block_on
        }) // block_in_place
    }
}

/// Custom ToolExecutor that tries built-in tools first, then falls back to MCP
pub struct TauriToolExecutor {
    mcp_client: Option<Arc<McpClient>>,
    app_handle: AppHandle,
    session_id: String,
}

impl TauriToolExecutor {
    pub fn new(
        mcp_client: Option<Arc<McpClient>>,
        app_handle: AppHandle,
        session_id: String,
    ) -> Self {
        Self {
            mcp_client,
            app_handle,
            session_id,
        }
    }
}

impl ToolExecutor for TauriToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        let value: serde_json::Value =
            serde_json::from_str(input).map_err(|e| ToolError::new(e.to_string()))?;

        // Try built-in tools first
        match tools::execute_tool(tool_name, &value) {
            Ok(output) => {
                // Emit success event
                let _ = self.app_handle.emit(
                    &format!("chat-tool-result:{}", self.session_id),
                    json!({
                        "name": tool_name,
                        "result": serde_json::from_str::<Value>(&output).unwrap_or(json!(output)),
                        "status": "success"
                    }),
                );
                Ok(output)
            }
            Err(_) => {
                // If not a built-in tool, try MCP
                if let Some(mcp) = &self.mcp_client {
                    // Need to block_in_place since ToolExecutor is sync but we're inside async
                    let result = tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current().block_on(mcp.call_tool(tool_name, value))
                    });

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

                            let _ = self.app_handle.emit(
                                &format!("chat-tool-result:{}", self.session_id),
                                json!({
                                    "name": tool_name,
                                    "result": result_val,
                                    "status": "success"
                                }),
                            );

                            Ok(result_text)
                        }
                        Err(e) => {
                            let _ = self.app_handle.emit(
                                &format!("chat-tool-result:{}", self.session_id),
                                json!({
                                    "name": tool_name,
                                    "error": e,
                                    "status": "error"
                                }),
                            );
                            Err(ToolError::new(e))
                        }
                    }
                } else {
                    Err(ToolError::new(format!("unknown tool: {}", tool_name)))
                }
            }
        }
    }
}

/// Simple permission policy that allows all tools
pub fn create_permission_policy() -> PermissionPolicy {
    PermissionPolicy::new(PermissionMode::Allow)
}

/// No-op permission prompter (we handle permissions in the UI)
pub struct TauriPermissionPrompter;

impl PermissionPrompter for TauriPermissionPrompter {
    fn decide(&mut self, _request: &PermissionRequest) -> runtime::PermissionPromptDecision {
        runtime::PermissionPromptDecision::Allow
    }
}
