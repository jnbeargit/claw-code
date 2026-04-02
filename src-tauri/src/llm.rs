use async_trait::async_trait;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::mcp_client::McpTool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUse {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_use_id: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub enum StreamEvent {
    TextDelta(String),
    ToolUse(ToolUse),
    Complete,
    Error(String),
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn send_message(
        &self,
        messages: Vec<Message>,
        tools: Vec<McpTool>,
        callback: Box<dyn Fn(StreamEvent) + Send + Sync>,
    ) -> Result<Vec<ToolUse>, String>;
}

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
    
    fn convert_tools(&self, tools: Vec<McpTool>) -> Vec<Value> {
        tools
            .into_iter()
            .map(|tool| {
                json!({
                    "name": tool.name,
                    "description": tool.description.unwrap_or_default(),
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
        messages: Vec<Message>,
        tools: Vec<McpTool>,
        callback: Box<dyn Fn(StreamEvent) + Send + Sync>,
    ) -> Result<Vec<ToolUse>, String> {
        let tools_json = self.convert_tools(tools);
        
        let request_body = json!({
            "model": self.model,
            "max_tokens": 4096,
            "messages": messages.iter().map(|m| {
                json!({
                    "role": m.role,
                    "content": m.content
                })
            }).collect::<Vec<_>>(),
            "tools": tools_json,
            "stream": true
        });
        
        let response = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }
        
        let mut stream = response.bytes_stream().eventsource();
        let mut tool_uses = Vec::new();
        
        while let Some(event) = stream.next().await {
            match event {
                Ok(event) => {
                    if event.data == "[DONE]" {
                        break;
                    }
                    
                    if let Ok(data) = serde_json::from_str::<Value>(&event.data) {
                        let event_type = data.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        
                        match event_type {
                            "content_block_delta" => {
                                if let Some(delta) = data.get("delta") {
                                    if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                        callback(StreamEvent::TextDelta(text.to_string()));
                                    }
                                }
                            }
                            "content_block_start" => {
                                if let Some(content_block) = data.get("content_block") {
                                    if content_block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                                        if let (Some(id), Some(name)) = (
                                            content_block.get("id").and_then(|i| i.as_str()),
                                            content_block.get("name").and_then(|n| n.as_str()),
                                        ) {
                                            let tool_use = ToolUse {
                                                id: id.to_string(),
                                                name: name.to_string(),
                                                input: content_block.get("input").cloned().unwrap_or(json!({})),
                                            };
                                            callback(StreamEvent::ToolUse(tool_use.clone()));
                                            tool_uses.push(tool_use);
                                        }
                                    }
                                }
                            }
                            "message_stop" => {
                                callback(StreamEvent::Complete);
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    callback(StreamEvent::Error(format!("Stream error: {}", e)));
                    return Err(format!("Stream error: {}", e));
                }
            }
        }
        
        Ok(tool_uses)
    }
}

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
    
    fn convert_tools(&self, tools: Vec<McpTool>) -> Vec<Value> {
        tools
            .into_iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description.unwrap_or_default(),
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
        messages: Vec<Message>,
        tools: Vec<McpTool>,
        callback: Box<dyn Fn(StreamEvent) + Send + Sync>,
    ) -> Result<Vec<ToolUse>, String> {
        let tools_json = self.convert_tools(tools);
        
        let request_body = json!({
            "model": self.model,
            "messages": messages.iter().map(|m| {
                json!({
                    "role": m.role,
                    "content": m.content
                })
            }).collect::<Vec<_>>(),
            "tools": tools_json,
            "stream": true
        });
        
        let response = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }
        
        let mut stream = response.bytes_stream().eventsource();
        let mut tool_uses = Vec::new();
        
        while let Some(event) = stream.next().await {
            match event {
                Ok(event) => {
                    if event.data == "[DONE]" {
                        break;
                    }
                    
                    if let Ok(data) = serde_json::from_str::<Value>(&event.data) {
                        if let Some(choices) = data.get("choices").and_then(|c| c.as_array()) {
                            for choice in choices {
                                if let Some(delta) = choice.get("delta") {
                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                        callback(StreamEvent::TextDelta(content.to_string()));
                                    }
                                    
                                    if let Some(tool_calls) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                        for tool_call in tool_calls {
                                            if let (Some(id), Some(function)) = (
                                                tool_call.get("id").and_then(|i| i.as_str()),
                                                tool_call.get("function"),
                                            ) {
                                                if let (Some(name), Some(arguments)) = (
                                                    function.get("name").and_then(|n| n.as_str()),
                                                    function.get("arguments").and_then(|a| a.as_str()),
                                                ) {
                                                    let input: Value = serde_json::from_str(arguments)
                                                        .unwrap_or(json!({}));
                                                    
                                                    let tool_use = ToolUse {
                                                        id: id.to_string(),
                                                        name: name.to_string(),
                                                        input,
                                                    };
                                                    callback(StreamEvent::ToolUse(tool_use.clone()));
                                                    tool_uses.push(tool_use);
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                if let Some(finish_reason) = choice.get("finish_reason").and_then(|f| f.as_str()) {
                                    if finish_reason == "stop" || finish_reason == "tool_calls" {
                                        callback(StreamEvent::Complete);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    callback(StreamEvent::Error(format!("Stream error: {}", e)));
                    return Err(format!("Stream error: {}", e));
                }
            }
        }
        
        Ok(tool_uses)
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
