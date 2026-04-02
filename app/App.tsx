import { useState, useEffect } from 'react';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useMcp } from './hooks/useMcp';
import { Workspace } from './types';
import { Settings as SettingsIcon } from 'lucide-react';

function App() {
  const { workspaces, loading } = useWorkspaces();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [showSettings, setShowSettings] = useState(false);
  
  const { connected, connect } = useMcp(activeWorkspace?.id || null);

  // Auto-connect when workspace is selected
  useEffect(() => {
    if (activeWorkspace && !connected) {
      connect(activeWorkspace.mcp_url, activeWorkspace.api_key);
    }
  }, [activeWorkspace, connected, connect]);

  // Select first workspace by default
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0]);
    }
  }, [workspaces, activeWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        connected={connected}
      />
      
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {activeWorkspace?.name || 'Norg Desktop'}
            </h1>
            {connected && (
              <span className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Connected
              </span>
            )}
          </div>
          
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {activeWorkspace ? (
            <Chat
              workspaceId={activeWorkspace.id}
              sessionId={sessionId}
              connected={connected}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Select or create a workspace to get started</p>
            </div>
          )}
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
