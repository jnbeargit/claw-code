use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u32,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: Option<String>,
    id: Option<u32>,
    result: Option<Value>,
    error: Option<Value>,
}

pub struct McpClient {
    url: String,
    api_key: String,
    client: reqwest::Client,
    request_id: Arc<Mutex<u32>>,
    session_id: Arc<Mutex<Option<String>>>,
}

impl McpClient {
    pub fn new(url: String, api_key: String) -> Self {
        // Ensure URL has trailing slash (servers redirect without it and POST redirects fail)
        let url = if url.ends_with('/') { url } else { format!("{}/", url) };
        Self {
            url,
            api_key,
            client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::limited(5))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            request_id: Arc::new(Mutex::new(1)),
            session_id: Arc::new(Mutex::new(None)),
        }
    }

    async fn next_id(&self) -> u32 {
        let mut id = self.request_id.lock().await;
        let current = *id;
        *id += 1;
        current
    }

    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        let id = self.next_id().await;

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let req_body = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        let mut req_builder = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream");

        // Add auth
        if !self.api_key.is_empty() {
            req_builder =
                req_builder.header("Authorization", format!("Bearer {}", self.api_key));
        }

        // Add session id if we have one
        {
            let sid = self.session_id.lock().await;
            if let Some(ref s) = *sid {
                req_builder = req_builder.header("Mcp-Session-Id", s.as_str());
            }
        }

        let response = req_builder
            .body(req_body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        // Capture session id from response headers
        if let Some(sid) = response.headers().get("mcp-session-id") {
            if let Ok(s) = sid.to_str() {
                let mut stored = self.session_id.lock().await;
                *stored = Some(s.to_string());
            }
        }

        let status = response.status();
        if status.as_u16() == 202 {
            // Notification accepted, no body
            return Ok(json!({}));
        }

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("HTTP {}: {}", status.as_u16(), body));
        }

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let body_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        // Handle SSE responses (text/event-stream)
        if content_type.contains("text/event-stream") {
            for line in body_text.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();
                    if !data.is_empty() {
                        if let Ok(parsed) = serde_json::from_str::<JsonRpcResponse>(data) {
                            if let Some(error) = parsed.error {
                                return Err(format!("MCP error: {}", error));
                            }
                            if let Some(result) = parsed.result {
                                return Ok(result);
                            }
                        }
                    }
                }
            }
            return Err("No valid JSON-RPC response in SSE stream".to_string());
        }

        // Handle plain JSON response
        if body_text.trim().is_empty() {
            return Ok(json!({}));
        }

        let json_response: JsonRpcResponse = serde_json::from_str(&body_text)
            .map_err(|e| format!("Failed to parse response: {} — body: {}", e, &body_text[..body_text.len().min(200)]))?;

        if let Some(error) = json_response.error {
            return Err(format!("MCP error: {}", error));
        }

        json_response
            .result
            .ok_or_else(|| "No result in response".to_string())
    }

    pub async fn initialize(&self) -> Result<(), String> {
        let params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "norg-desktop",
                "version": "0.1.0"
            }
        });

        let _result = self.send_request("initialize", Some(params)).await?;

        // Send initialized notification
        let id = self.next_id().await;
        let notification = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "notifications/initialized",
            "params": {}
        });

        let mut req_builder = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream");

        if !self.api_key.is_empty() {
            req_builder =
                req_builder.header("Authorization", format!("Bearer {}", self.api_key));
        }

        {
            let sid = self.session_id.lock().await;
            if let Some(ref s) = *sid {
                req_builder = req_builder.header("Mcp-Session-Id", s.as_str());
            }
        }

        // Fire and forget the notification
        let _ = req_builder
            .json(&notification)
            .send()
            .await;

        Ok(())
    }

    pub async fn list_tools(&self) -> Result<Vec<McpTool>, String> {
        let result = self.send_request("tools/list", Some(json!({}))).await?;

        let tools_array = result
            .get("tools")
            .ok_or("No 'tools' field in response")?
            .as_array()
            .ok_or("'tools' is not an array")?;

        let tools: Vec<McpTool> = tools_array
            .iter()
            .filter_map(|tool| serde_json::from_value(tool.clone()).ok())
            .collect();

        Ok(tools)
    }

    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value, String> {
        let params = json!({
            "name": name,
            "arguments": arguments
        });

        let result = self.send_request("tools/call", Some(params)).await?;
        Ok(result)
    }
}

// --- Tauri Commands ---

use std::collections::HashMap;
use tauri::State;

pub type McpConnections = Arc<Mutex<HashMap<String, Arc<McpClient>>>>;

#[tauri::command]
pub async fn mcp_connect(
    workspace_id: String,
    mcp_url: String,
    api_key: String,
    connections: State<'_, McpConnections>,
) -> Result<usize, String> {
    let client = Arc::new(McpClient::new(mcp_url, api_key));

    // Initialize MCP session
    client.initialize().await?;

    // Verify by listing tools
    let tools = client.list_tools().await?;
    let tool_count = tools.len();

    let mut conns = connections.lock().await;
    conns.insert(workspace_id, client);

    Ok(tool_count)
}

#[tauri::command]
pub async fn mcp_disconnect(
    workspace_id: String,
    connections: State<'_, McpConnections>,
) -> Result<(), String> {
    let mut conns = connections.lock().await;
    conns.remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(
    workspace_id: String,
    connections: State<'_, McpConnections>,
) -> Result<Vec<McpTool>, String> {
    let conns = connections.lock().await;
    let client = conns
        .get(&workspace_id)
        .ok_or("Not connected — import a .mcpb bundle or configure a workspace first")?;
    client.list_tools().await
}

#[tauri::command]
pub async fn mcp_call_tool(
    workspace_id: String,
    tool_name: String,
    arguments: Value,
    connections: State<'_, McpConnections>,
) -> Result<Value, String> {
    let conns = connections.lock().await;
    let client = conns.get(&workspace_id).ok_or("Not connected")?;
    client.call_tool(&tool_name, arguments).await
}
