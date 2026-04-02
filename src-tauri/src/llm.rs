use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::mcp_client::McpTool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: Value, // Can be string or array of content blocks
}

impl Message {
    pub fn text(role: &str, text: &str) -> Self {
        Self {
            role: role.to_string(),
            content: Value::String(text.to_string()),
        }
    }

    pub fn tool_use_block(id: &str, name: &str, input: &Value) -> Value {
        json!({
            "type": "tool_use",
            "id": id,
            "name": name,
            "input": input
        })
    }

    pub fn tool_result_block(tool_use_id: &str, content: &str) -> Value {
        json!({
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": content
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUse {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone)]
pub enum StreamEvent {
    TextDelta(String),
    ToolUse(ToolUse),
    Complete(String), // full accumulated text
    Error(String),
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn send_message(
        &self,
        messages: &[Message],
        tools: &[McpTool],
        callback: &(dyn Fn(StreamEvent) + Send + Sync),
    ) -> Result<(String, Vec<ToolUse>), String>;
}

// --- Anthropic ---

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }

    fn convert_tools(tools: &[McpTool]) -> Vec<Value> {
        tools
            .iter()
            .map(|tool| {
                json!({
                    "name": tool.name,
                    "description": tool.description.clone().unwrap_or_default(),
                    "input_schema": tool.input_schema
                })
            })
            .collect()
    }
}

#[async_trait]
impl LlmProvider for AnthropicProvider {
    async fn send_message(
        &self,
        messages: &[Message],
        tools: &[McpTool],
        callback: &(dyn Fn(StreamEvent) + Send + Sync),
    ) -> Result<(String, Vec<ToolUse>), String> {
        let tools_json = Self::convert_tools(tools);

        let messages_json: Vec<Value> = messages
            .iter()
            .map(|m| {
                json!({
                    "role": m.role,
                    "content": m.content
                })
            })
            .collect();

        let mut request_body = json!({
            "model": self.model,
            "max_tokens": 8192,
            "messages": messages_json,
            "stream": true
        });

        if !tools_json.is_empty() {
            request_body["tools"] = Value::Array(tools_json);
        }

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Anthropic request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error {}: {}", status, body));
        }

        // Read full SSE body and parse line by line
        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        let mut full_text = String::new();
        let mut tool_uses: Vec<ToolUse> = Vec::new();
        let mut current_tool_id = String::new();
        let mut current_tool_name = String::new();
        let mut current_tool_input_json = String::new();
        let mut in_tool_block = false;

        for line in body.lines() {
            let data = match line.strip_prefix("data: ") {
                Some(d) => d.trim(),
                None => continue,
            };
            if data.is_empty() || data == "[DONE]" {
                continue;
            }

            let event: Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let event_type = event
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("");

            match event_type {
                "content_block_start" => {
                    if let Some(block) = event.get("content_block") {
                        let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        if block_type == "tool_use" {
                            in_tool_block = true;
                            current_tool_id = block
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            current_tool_name = block
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            current_tool_input_json.clear();
                        } else {
                            in_tool_block = false;
                        }
                    }
                }
                "content_block_delta" => {
                    if let Some(delta) = event.get("delta") {
                        let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        match delta_type {
                            "text_delta" => {
                                if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                    full_text.push_str(text);
                                    callback(StreamEvent::TextDelta(text.to_string()));
                                }
                            }
                            "input_json_delta" => {
                                if in_tool_block {
                                    if let Some(partial) =
                                        delta.get("partial_json").and_then(|t| t.as_str())
                                    {
                                        current_tool_input_json.push_str(partial);
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                "content_block_stop" => {
                    if in_tool_block && !current_tool_id.is_empty() {
                        let input: Value =
                            serde_json::from_str(&current_tool_input_json).unwrap_or(json!({}));
                        let tool_use = ToolUse {
                            id: current_tool_id.clone(),
                            name: current_tool_name.clone(),
                            input,
                        };
                        callback(StreamEvent::ToolUse(tool_use.clone()));
                        tool_uses.push(tool_use);
                        in_tool_block = false;
                        current_tool_id.clear();
                        current_tool_name.clear();
                        current_tool_input_json.clear();
                    }
                }
                "message_stop" => {
                    callback(StreamEvent::Complete(full_text.clone()));
                }
                "error" => {
                    let msg = event
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    callback(StreamEvent::Error(msg.to_string()));
                    return Err(msg.to_string());
                }
                _ => {}
            }
        }

        Ok((full_text, tool_uses))
    }
}

// --- OpenAI ---

pub struct OpenAiProvider {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl OpenAiProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }

    fn convert_tools(tools: &[McpTool]) -> Vec<Value> {
        tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description.clone().unwrap_or_default(),
                        "parameters": tool.input_schema
                    }
                })
            })
            .collect()
    }
}

#[async_trait]
impl LlmProvider for OpenAiProvider {
    async fn send_message(
        &self,
        messages: &[Message],
        tools: &[McpTool],
        callback: &(dyn Fn(StreamEvent) + Send + Sync),
    ) -> Result<(String, Vec<ToolUse>), String> {
        let tools_json = Self::convert_tools(tools);

        let messages_json: Vec<Value> = messages
            .iter()
            .map(|m| {
                json!({
                    "role": m.role,
                    "content": m.content
                })
            })
            .collect();

        let mut request_body = json!({
            "model": self.model,
            "messages": messages_json,
            "stream": true
        });

        if !tools_json.is_empty() {
            request_body["tools"] = Value::Array(tools_json);
        }

        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("OpenAI request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, body));
        }

        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        let mut full_text = String::new();
        let mut tool_calls_map: std::collections::HashMap<i64, (String, String, String)> =
            std::collections::HashMap::new(); // index -> (id, name, arguments_json)

        for line in body.lines() {
            let data = match line.strip_prefix("data: ") {
                Some(d) => d.trim(),
                None => continue,
            };
            if data.is_empty() || data == "[DONE]" {
                continue;
            }

            let chunk: Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(choices) = chunk.get("choices").and_then(|c| c.as_array()) {
                for choice in choices {
                    if let Some(delta) = choice.get("delta") {
                        // Text content
                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                            full_text.push_str(content);
                            callback(StreamEvent::TextDelta(content.to_string()));
                        }

                        // Tool calls (streamed incrementally)
                        if let Some(tool_calls) =
                            delta.get("tool_calls").and_then(|t| t.as_array())
                        {
                            for tc in tool_calls {
                                let index = tc.get("index").and_then(|i| i.as_i64()).unwrap_or(0);
                                let entry = tool_calls_map
                                    .entry(index)
                                    .or_insert_with(|| (String::new(), String::new(), String::new()));

                                if let Some(id) = tc.get("id").and_then(|i| i.as_str()) {
                                    entry.0 = id.to_string();
                                }
                                if let Some(function) = tc.get("function") {
                                    if let Some(name) =
                                        function.get("name").and_then(|n| n.as_str())
                                    {
                                        entry.1 = name.to_string();
                                    }
                                    if let Some(args) =
                                        function.get("arguments").and_then(|a| a.as_str())
                                    {
                                        entry.2.push_str(args);
                                    }
                                }
                            }
                        }
                    }

                    if let Some(finish) = choice.get("finish_reason").and_then(|f| f.as_str()) {
                        if finish == "stop" || finish == "tool_calls" {
                            callback(StreamEvent::Complete(full_text.clone()));
                        }
                    }
                }
            }
        }

        // Build final tool uses
        let mut tool_uses: Vec<ToolUse> = Vec::new();
        let mut indices: Vec<i64> = tool_calls_map.keys().cloned().collect();
        indices.sort();
        for idx in indices {
            if let Some((id, name, args_json)) = tool_calls_map.get(&idx) {
                let input: Value = serde_json::from_str(args_json).unwrap_or(json!({}));
                let tool_use = ToolUse {
                    id: id.clone(),
                    name: name.clone(),
                    input,
                };
                callback(StreamEvent::ToolUse(tool_use.clone()));
                tool_uses.push(tool_use);
            }
        }

        Ok((full_text, tool_uses))
    }
}

pub fn create_provider(
    provider: &str,
    api_key: String,
    model: String,
) -> Result<Box<dyn LlmProvider>, String> {
    match provider {
        "anthropic" => Ok(Box::new(AnthropicProvider::new(api_key, model))),
        "openai" => Ok(Box::new(OpenAiProvider::new(api_key, model))),
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}
