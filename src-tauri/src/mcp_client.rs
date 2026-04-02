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
    params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u32,
    result: Option<Value>,
    error: Option<Value>,
}

pub struct McpClient {
    url: String,
    api_key: String,
    client: reqwest::Client,
    request_id: Arc<Mutex<u32>>,
}

impl McpClient {
    pub fn new(url: String, api_key: String) -> Self {
        Self {
            url,
            api_key,
            client: reqwest::Client::new(),
            request_id: Arc::new(Mutex::new(1)),
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
        
        let response = self.client
            .post(&self.url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }
        
        let json_response: JsonRpcResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        if let Some(error) = json_response.error {
            return Err(format!("MCP error: {}", error));
        }
        
        json_response.result.ok_or_else(|| "No result in response".to_string())
    }
    
    pub async fn list_tools(&self) -> Result<Vec<McpTool>, String> {
        let result = self.send_request("tools/list", None).await?;
        
        let tools = result
            .get("tools")
            .ok_or("No tools in response")?
            .as_array()
            .ok_or("Tools is not an array")?
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
    
    pub async fn test_connection(&self) -> Result<(), String> {
        // Try to list tools as a connection test
        self.list_tools().await?;
        Ok(())
    }
}

// Tauri commands for MCP operations
use std::collections::HashMap;
use tauri::State;

pub type McpConnections = Arc<Mutex<HashMap<String, Arc<McpClient>>>>;

#[tauri::command]
pub async fn mcp_connect(
    workspace_id: String,
    mcp_url: String,
    api_key: String,
    connections: State<'_, McpConnections>,
) -> Result<(), String> {
    let client = Arc::new(McpClient::new(mcp_url, api_key));
    
    // Test the connection
    client.test_connection().await?;
    
    let mut conns = connections.lock().await;
    conns.insert(workspace_id, client);
    
    Ok(())
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
    let client = conns.get(&workspace_id).ok_or("Not connected")?;
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
