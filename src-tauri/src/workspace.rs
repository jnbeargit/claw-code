use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub mcp_url: String,
    pub api_key: String,
    pub llm_provider: String, // "anthropic" or "openai"
    pub llm_api_key: String,
    pub llm_model: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceStore {
    pub workspaces: Vec<Workspace>,
}

impl WorkspaceStore {
    fn get_storage_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        let norg_dir = home.join(".norg-desktop");
        
        if !norg_dir.exists() {
            fs::create_dir_all(&norg_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        
        Ok(norg_dir.join("workspaces.json"))
    }
    
    pub fn load() -> Result<Self, String> {
        let path = Self::get_storage_path()?;
        
        if !path.exists() {
            return Ok(WorkspaceStore {
                workspaces: Vec::new(),
            });
        }
        
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read workspaces file: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse workspaces file: {}", e))
    }
    
    pub fn save(&self) -> Result<(), String> {
        let path = Self::get_storage_path()?;
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize workspaces: {}", e))?;
        
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write workspaces file: {}", e))
    }
}

#[tauri::command]
pub async fn list_workspaces() -> Result<Vec<Workspace>, String> {
    let store = WorkspaceStore::load()?;
    Ok(store.workspaces)
}

#[tauri::command]
pub async fn create_workspace(
    name: String,
    mcp_url: String,
    api_key: String,
    llm_provider: String,
    llm_api_key: String,
    llm_model: String,
) -> Result<Workspace, String> {
    let mut store = WorkspaceStore::load()?;
    
    let workspace = Workspace {
        id: Uuid::new_v4().to_string(),
        name,
        mcp_url,
        api_key,
        llm_provider,
        llm_api_key,
        llm_model,
        created_at: Utc::now(),
    };
    
    store.workspaces.push(workspace.clone());
    store.save()?;
    
    Ok(workspace)
}

#[tauri::command]
pub async fn update_workspace(
    id: String,
    name: String,
    mcp_url: String,
    api_key: String,
    llm_provider: String,
    llm_api_key: String,
    llm_model: String,
) -> Result<Workspace, String> {
    let mut store = WorkspaceStore::load()?;
    
    let workspace = store.workspaces.iter_mut()
        .find(|w| w.id == id)
        .ok_or("Workspace not found")?;
    
    workspace.name = name;
    workspace.mcp_url = mcp_url;
    workspace.api_key = api_key;
    workspace.llm_provider = llm_provider;
    workspace.llm_api_key = llm_api_key;
    workspace.llm_model = llm_model;
    
    let updated = workspace.clone();
    store.save()?;
    
    Ok(updated)
}

#[tauri::command]
pub async fn delete_workspace(id: String) -> Result<(), String> {
    let mut store = WorkspaceStore::load()?;
    store.workspaces.retain(|w| w.id != id);
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_workspace(id: String) -> Result<Workspace, String> {
    let store = WorkspaceStore::load()?;
    store.workspaces
        .into_iter()
        .find(|w| w.id == id)
        .ok_or("Workspace not found".to_string())
}

// --- MCPB Bundle Import ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpbManifest {
    pub manifest_version: Option<String>,
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpbImportResult {
    pub workspace: Workspace,
    pub display_name: String,
    pub description: String,
    pub tool_count: Option<usize>,
}

fn extract_bearer_token(server_js: &str) -> Option<String> {
    // Look for patterns like: Bearer norg_ak_... or 'Bearer ...' in AUTH constant
    for line in server_js.lines() {
        if let Some(pos) = line.find("Bearer ") {
            let after = &line[pos + 7..];
            // Extract token: take chars until quote, semicolon, or whitespace
            let token: String = after
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_')
                .collect();
            if !token.is_empty() {
                return Some(token);
            }
        }
    }
    None
}

fn extract_mcp_url(server_js: &str) -> Option<String> {
    // Look for MCP_URL constant
    for line in server_js.lines() {
        if line.contains("MCP_URL") && line.contains("http") {
            // Extract URL between quotes
            if let Some(start) = line.find("http") {
                let url: String = line[start..]
                    .chars()
                    .take_while(|c| !matches!(*c, '\'' | '"' | ';' | '`'))
                    .collect();
                if !url.is_empty() {
                    return Some(url);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn import_mcpb_bundle(
    file_path: String,
    llm_provider: String,
    llm_api_key: String,
    llm_model: String,
) -> Result<McpbImportResult, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read bundle (not a valid .mcpb file): {}", e))?;

    // Read manifest.json
    let manifest: McpbManifest = {
        let mut entry = archive.by_name("manifest.json")
            .map_err(|_| "Bundle missing manifest.json".to_string())?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        serde_json::from_str(&buf)
            .map_err(|e| format!("Failed to parse manifest.json: {}", e))?
    };

    // Read server.mjs to extract MCP URL and token
    let (mcp_url, api_key) = {
        let mut entry = archive.by_name("server.mjs")
            .map_err(|_| "Bundle missing server.mjs".to_string())?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read server.mjs: {}", e))?;

        let url = extract_mcp_url(&buf)
            .ok_or("Could not find MCP URL in bundle")?;
        let token = extract_bearer_token(&buf)
            .ok_or("Could not find API key/token in bundle")?;

        (url, token)
    };

    let display_name = manifest.display_name.clone()
        .unwrap_or_else(|| manifest.name.clone().unwrap_or("Imported Workspace".into()));
    let description = manifest.description.clone().unwrap_or_default();

    // Create workspace
    let workspace = Workspace {
        id: Uuid::new_v4().to_string(),
        name: display_name.clone(),
        mcp_url,
        api_key: format!("norg_ak_{}", api_key.trim_start_matches("norg_ak_")),
        llm_provider,
        llm_api_key,
        llm_model,
        created_at: Utc::now(),
    };

    let mut store = WorkspaceStore::load()?;
    store.workspaces.push(workspace.clone());
    store.save()?;

    // Copy bundle to ~/.norg-desktop/bundles/
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let bundles_dir = home.join(".norg-desktop").join("bundles");
    if !bundles_dir.exists() {
        fs::create_dir_all(&bundles_dir)
            .map_err(|e| format!("Failed to create bundles dir: {}", e))?;
    }
    let dest = bundles_dir.join(format!("{}.mcpb", workspace.id));
    fs::copy(path, &dest)
        .map_err(|e| format!("Failed to copy bundle: {}", e))?;

    Ok(McpbImportResult {
        workspace,
        display_name,
        description,
        tool_count: None,
    })
}

#[tauri::command]
pub async fn peek_mcpb_bundle(file_path: String) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Not a valid .mcpb bundle: {}", e))?;

    let manifest: McpbManifest = {
        let mut entry = archive.by_name("manifest.json")
            .map_err(|_| "Bundle missing manifest.json".to_string())?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        serde_json::from_str(&buf)
            .map_err(|e| format!("Failed to parse manifest.json: {}", e))?
    };

    // Read server.mjs to extract URL
    let mcp_url = {
        let mut entry = archive.by_name("server.mjs")
            .map_err(|_| "Bundle missing server.mjs".to_string())?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read server.mjs: {}", e))?;
        extract_mcp_url(&buf).unwrap_or_default()
    };

    Ok(serde_json::json!({
        "name": manifest.name,
        "display_name": manifest.display_name,
        "description": manifest.description,
        "version": manifest.version,
        "mcp_url": mcp_url,
    }))
}
