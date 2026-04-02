import { useState } from 'react';
import { Plus, Search, FolderOpen, Settings, ChevronDown, ChevronUp, Check, FileUp } from 'lucide-react';
import type { Workspace } from '@/types';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  connected: boolean;
  onWorkspaceSelect: (workspace: Workspace) => void;
  onNewWorkspace: () => void;
  onImportBundle: () => void;
  onNewChat: () => void;
  onSettings: () => void;
  onSearch: () => void;
}

export function WorkspaceSidebar({
  workspaces,
  currentWorkspace,
  connected,
  onWorkspaceSelect,
  onNewWorkspace,
  onImportBundle,
  onNewChat,
  onSettings,
  onSearch,
}: WorkspaceSidebarProps) {
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="w-[260px] bg-bg-sidebar border-r border-border flex flex-col h-full">
      {/* Navigation */}
      <div className="p-3 space-y-1">
        <button onClick={onNewChat} className="nav-item w-full">
          <Plus className="w-4 h-4" />
          <span>New chat</span>
        </button>
        
        <button onClick={onSearch} className="nav-item w-full">
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>
        
        <button onClick={onNewWorkspace} className="nav-item w-full">
          <FolderOpen className="w-4 h-4" />
          <span>Workspaces</span>
        </button>
        
        <button onClick={onImportBundle} className="nav-item w-full">
          <FileUp className="w-4 h-4" />
          <span>Import .mcpb</span>
        </button>
        
        <button onClick={onSettings} className="nav-item w-full">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-3" />

      {/* Recents */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
          Recents
        </div>
        
        {/* Placeholder for recent chats */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md hover:bg-bg-hover cursor-pointer">
            <div className="w-2 h-2 rounded-full bg-accent-blue" />
            <span className="truncate">Current session</span>
          </div>
        </div>
      </div>

      {/* MCP Tools note */}
      <div className="px-3 pb-3">
        <p className="text-xs text-text-tertiary">
          Connect MCP servers to enable tools
        </p>
      </div>

      {/* Workspace info card */}
      <div className="p-3 pt-0 relative">
        <button
          onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
          className="w-full p-3 rounded-lg bg-bg-card border border-border hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(currentWorkspace?.name || 'N')} flex items-center justify-center text-white text-xs font-semibold`}>
              {currentWorkspace ? getInitials(currentWorkspace.name) : 'N'}
            </div>
            
            {/* Workspace info */}
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate">
                {currentWorkspace?.name || 'No workspace'}
              </div>
              <div className="text-xs text-text-secondary flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent-green' : 'bg-text-tertiary'}`} />
                <span>{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
            
            {/* Chevron */}
            {showWorkspaceSwitcher ? (
              <ChevronUp className="w-4 h-4 text-text-secondary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            )}
          </div>
        </button>

        {/* Workspace switcher dropdown */}
        {showWorkspaceSwitcher && (
          <div className="absolute bottom-full left-3 right-3 mb-2 p-2 bg-bg-card border border-border rounded-lg shadow-xl animate-slide-up">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    onWorkspaceSelect(workspace);
                    setShowWorkspaceSwitcher(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-hover transition-colors"
                >
                  <div className={`w-6 h-6 rounded-full ${getAvatarColor(workspace.name)} flex items-center justify-center text-white text-xs font-semibold`}>
                    {getInitials(workspace.name)}
                  </div>
                  <span className="flex-1 text-left text-sm truncate">
                    {workspace.name}
                  </span>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="w-4 h-4 text-accent-green" />
                  )}
                </button>
              ))}
            </div>
            
            {/* Add workspace */}
            <div className="h-px bg-border my-2" />
            <button
              onClick={() => {
                onNewWorkspace();
                setShowWorkspaceSwitcher(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-hover transition-colors text-text-primary"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add workspace</span>
            </button>
            <button
              onClick={() => {
                onImportBundle();
                setShowWorkspaceSwitcher(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-hover transition-colors text-text-primary"
            >
              <FileUp className="w-4 h-4" />
              <span className="text-sm">Import .mcpb bundle</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
