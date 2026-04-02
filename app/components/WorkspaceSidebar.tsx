import { useState } from 'react';
import { Plus, MoreVertical } from 'lucide-react';
import type { Workspace } from '@/types';
import { WorkspaceSetup } from './WorkspaceSetup';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  connected: boolean;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  connected,
}: WorkspaceSidebarProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  return (
    <>
      <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <h2 className="font-semibold">Workspaces</h2>
          <button
            onClick={() => setShowSetup(true)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Add workspace"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {workspaces.length === 0 ? (
            <div className="text-center text-gray-400 py-8 px-4 text-sm">
              <p>No workspaces yet.</p>
              <p className="mt-2">Click + to create one.</p>
            </div>
          ) : (
            workspaces.map((workspace) => {
              const isActive = activeWorkspace?.id === workspace.id;
              const isConnected = isActive && connected;

              return (
                <div
                  key={workspace.id}
                  className={`
                    group relative p-3 rounded-lg cursor-pointer transition-colors mb-2
                    ${isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-700'}
                  `}
                  onClick={() => onSelectWorkspace(workspace)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={`
                          w-2 h-2 rounded-full flex-shrink-0
                          ${isConnected ? 'bg-green-400' : 'bg-gray-600'}
                        `}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{workspace.name}</div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          {workspace.llm_provider}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingWorkspace(workspace);
                        setShowSetup(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-400">
          <div>Norg Desktop v0.1.0</div>
          <div className="mt-1">{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {showSetup && (
        <WorkspaceSetup
          workspace={editingWorkspace}
          onClose={() => {
            setShowSetup(false);
            setEditingWorkspace(null);
          }}
        />
      )}
    </>
  );
}
