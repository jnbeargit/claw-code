import { X } from 'lucide-react';
import type { Workspace } from '@/types';

interface SettingsProps {
  workspace: Workspace | null;
  onEdit: (workspace: Workspace) => void;
  onClose: () => void;
}

export function Settings({ workspace, onEdit, onClose }: SettingsProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[800px] mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Workspace</h2>
            
            {workspace ? (
              <div className="card p-6 space-y-4">
                <div>
                  <div className="text-sm text-text-secondary mb-1">Name</div>
                  <div className="text-base text-text-primary">{workspace.name}</div>
                </div>

                <div>
                  <div className="text-sm text-text-secondary mb-1">MCP Server</div>
                  <div className="text-base text-text-primary font-mono text-sm">
                    {workspace.mcp_url}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-text-secondary mb-1">LLM Provider</div>
                  <div className="text-base text-text-primary capitalize">
                    {workspace.llm_provider}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-text-secondary mb-1">Model</div>
                  <div className="text-base text-text-primary font-mono text-sm">
                    {workspace.llm_model}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => onEdit(workspace)}
                    className="btn-secondary"
                  >
                    Edit Workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-6 text-center text-text-secondary">
                No workspace selected
              </div>
            )}
          </div>

          {/* About section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">About</h2>
            <div className="card p-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Version</span>
                <span className="text-text-primary">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Platform</span>
                <span className="text-text-primary">Tauri</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
