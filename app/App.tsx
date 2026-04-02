import { useState, useEffect } from 'react';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { WorkspaceSetup } from './components/WorkspaceSetup';
import { ImportBundle } from './components/ImportBundle';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useMcp } from './hooks/useMcp';
import type { Workspace } from './types';

type View = 'home' | 'chat' | 'settings' | 'search';

function App() {
  const { workspaces, loading, createWorkspace, updateWorkspace } = useWorkspaces();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [currentView, setCurrentView] = useState<View>('home');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showImportBundle, setShowImportBundle] = useState(false);

  const { connected, tools, connect } = useMcp(currentWorkspace?.id || null);

  // Auto-select first workspace on load
  useEffect(() => {
    if (!loading && workspaces.length > 0 && !currentWorkspace) {
      const firstWorkspace = workspaces[0];
      setCurrentWorkspace(firstWorkspace);
      
      // Auto-connect to MCP
      if (firstWorkspace.mcp_url && firstWorkspace.api_key) {
        connect(firstWorkspace.mcp_url, firstWorkspace.api_key);
      }
    }
  }, [loading, workspaces, currentWorkspace, connect]);

  const handleWorkspaceSelect = async (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    
    // Connect to MCP
    if (workspace.mcp_url && workspace.api_key) {
      await connect(workspace.mcp_url, workspace.api_key);
    }
  };

  const handleWorkspaceCreate = async (data: Omit<Workspace, 'id' | 'created_at'>): Promise<void> => {
    const workspace = await createWorkspace(data);
    setCurrentWorkspace(workspace);
    
    // Connect to MCP
    if (workspace.mcp_url && workspace.api_key) {
      await connect(workspace.mcp_url, workspace.api_key);
    }
    
    setShowWorkspaceSetup(false);
    setEditingWorkspace(null);
  };

  const handleWorkspaceUpdate = async (id: string, data: Omit<Workspace, 'id' | 'created_at'>): Promise<void> => {
    const workspace = await updateWorkspace(id, data);
    
    if (currentWorkspace?.id === id) {
      setCurrentWorkspace(workspace);
      
      // Reconnect to MCP
      if (workspace.mcp_url && workspace.api_key) {
        await connect(workspace.mcp_url, workspace.api_key);
      }
    }
    
    setShowWorkspaceSetup(false);
    setEditingWorkspace(null);
  };

  const handleNewChat = () => {
    setCurrentView('chat');
  };

  const renderMainContent = () => {
    if (currentView === 'settings') {
      return (
        <Settings
          workspace={currentWorkspace}
          onEdit={(workspace) => {
            setEditingWorkspace(workspace);
            setShowWorkspaceSetup(true);
          }}
          onClose={() => setCurrentView('home')}
        />
      );
    }

    if (currentView === 'chat' || currentView === 'home') {
      return (
        <Chat
          workspace={currentWorkspace}
          sessionId={sessionId}
          connected={connected}
          tools={tools}
          isHome={currentView === 'home'}
          onStartChat={() => setCurrentView('chat')}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-main">
      {/* Sidebar */}
      {sidebarOpen && (
        <WorkspaceSidebar
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          connected={connected}
          onWorkspaceSelect={handleWorkspaceSelect}
          onNewWorkspace={() => {
            setEditingWorkspace(null);
            setShowWorkspaceSetup(true);
          }}
          onImportBundle={() => setShowImportBundle(true)}
          onNewChat={handleNewChat}
          onSettings={() => setCurrentView('settings')}
          onSearch={() => setCurrentView('search')}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border drag-region">
          <div className="flex items-center gap-3 no-drag">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-6 h-6 flex items-center justify-center hover:bg-bg-hover rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Center: Workspace name */}
          <div className="text-sm font-medium">
            {currentWorkspace?.name || 'Norg Desktop'}
          </div>

          {/* Right spacer */}
          <div className="w-6" />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {renderMainContent()}
        </div>
      </div>

      {/* Workspace setup modal */}
      {showWorkspaceSetup && (
        <WorkspaceSetup
          workspace={editingWorkspace}
          onSave={async (data) => {
            if (editingWorkspace) {
              await handleWorkspaceUpdate(editingWorkspace.id, data);
            } else {
              await handleWorkspaceCreate(data);
            }
          }}
          onCancel={() => {
            setShowWorkspaceSetup(false);
            setEditingWorkspace(null);
          }}
        />
      )}

      {/* Import bundle modal */}
      {showImportBundle && (
        <ImportBundle
          onImported={async (workspace) => {
            setCurrentWorkspace(workspace);
            if (workspace.mcp_url && workspace.api_key) {
              await connect(workspace.mcp_url, workspace.api_key);
            }
            setShowImportBundle(false);
          }}
          onCancel={() => setShowImportBundle(false)}
        />
      )}
    </div>
  );
}

export default App;
