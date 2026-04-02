import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import type { Workspace } from '@/types';

interface WorkspaceSetupProps {
  workspace: Workspace | null;
  onClose: () => void;
}

export function WorkspaceSetup({ workspace, onClose }: WorkspaceSetupProps) {
  const { createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspaces();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mcp_url: '',
    api_key: '',
    llm_provider: 'anthropic' as 'anthropic' | 'openai',
    llm_api_key: '',
    llm_model: 'claude-sonnet-4',
  });

  useEffect(() => {
    if (workspace) {
      setFormData({
        name: workspace.name,
        mcp_url: workspace.mcp_url,
        api_key: workspace.api_key,
        llm_provider: workspace.llm_provider as 'anthropic' | 'openai',
        llm_api_key: workspace.llm_api_key,
        llm_model: workspace.llm_model,
      });
    }
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (workspace) {
        await updateWorkspace(workspace.id, formData);
      } else {
        await createWorkspace(formData);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace) return;
    if (!confirm(`Delete workspace "${workspace.name}"?`)) return;

    setLoading(true);
    try {
      await deleteWorkspace(workspace.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-lg border border-gray-800">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold">
            {workspace ? 'Edit Workspace' : 'New Workspace'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Workspace"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              MCP URL
            </label>
            <input
              type="url"
              value={formData.mcp_url}
              onChange={(e) => setFormData({ ...formData, mcp_url: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.norg.ai/mcp"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Norg API Key
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="norg_xxxxxxxxxxxx"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              LLM Provider
            </label>
            <select
              value={formData.llm_provider}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  llm_provider: e.target.value as 'anthropic' | 'openai',
                  llm_model: e.target.value === 'anthropic' ? 'claude-sonnet-4' : 'gpt-4-turbo',
                })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              LLM API Key
            </label>
            <input
              type="password"
              value={formData.llm_api_key}
              onChange={(e) => setFormData({ ...formData, llm_api_key: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={formData.llm_provider === 'anthropic' ? 'sk-ant-xxxx' : 'sk-xxxx'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Model
            </label>
            <input
              type="text"
              value={formData.llm_model}
              onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={formData.llm_provider === 'anthropic' ? 'claude-sonnet-4' : 'gpt-4-turbo'}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {workspace && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {workspace ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
