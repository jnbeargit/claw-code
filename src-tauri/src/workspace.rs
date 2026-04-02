use serde::{Deserialize, Serialize};
use std::fs;
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
