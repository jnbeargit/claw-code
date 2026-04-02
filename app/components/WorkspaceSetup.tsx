import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Workspace } from '@/types';

interface WorkspaceSetupProps {
  workspace?: Workspace | null;
  onSave: (data: Omit<Workspace, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}

export function WorkspaceSetup({ workspace, onSave, onCancel }: WorkspaceSetupProps) {
  const [formData, setFormData] = useState({
    name: workspace?.name || '',
    mcp_url: workspace?.mcp_url || '',
    api_key: workspace?.api_key || '',
    llm_provider: workspace?.llm_provider || 'anthropic',
    llm_api_key: workspace?.llm_api_key || '',
    llm_model: workspace?.llm_model || 'claude-3-5-sonnet-20241022',
  });
  
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    // Simulate test connection - replace with actual Tauri invoke
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setTesting(false);
    setTestResult({
      success: true,
      message: 'Connection successful! MCP server is responding.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save workspace:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-[500px] bg-bg-card border border-border rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">
            {workspace ? 'Edit Workspace' : 'New Workspace'}
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Workspace name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="My Workspace"
              className="input-field"
              required
            />
          </div>

          {/* MCP Server */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              MCP Server URL
            </label>
            <input
              type="url"
              value={formData.mcp_url}
              onChange={(e) => handleChange('mcp_url', e.target.value)}
              placeholder="http://localhost:3000"
              className="input-field"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              MCP API Key
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => handleChange('api_key', e.target.value)}
              placeholder="sk-..."
              className="input-field"
              required
            />
          </div>

          {/* LLM Provider */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              LLM Provider
            </label>
            <select
              value={formData.llm_provider}
              onChange={(e) => handleChange('llm_provider', e.target.value as 'anthropic' | 'openai')}
              className="input-field"
              required
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>

          {/* LLM Model */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Model
            </label>
            <input
              type="text"
              value={formData.llm_model}
              onChange={(e) => handleChange('llm_model', e.target.value)}
              placeholder="claude-3-5-sonnet-20241022"
              className="input-field"
              required
            />
            <p className="text-xs text-text-tertiary mt-1">
              {formData.llm_provider === 'anthropic' 
                ? 'e.g., claude-3-5-sonnet-20241022, claude-3-opus-20240229'
                : 'e.g., gpt-4, gpt-3.5-turbo'}
            </p>
          </div>

          {/* LLM API Key */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {formData.llm_provider === 'anthropic' ? 'Anthropic API Key' : 'OpenAI API Key'}
            </label>
            <input
              type="password"
              value={formData.llm_api_key}
              onChange={(e) => handleChange('llm_api_key', e.target.value)}
              placeholder="sk-..."
              className="input-field"
              required
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-accent-green/10 text-accent-green' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !formData.mcp_url || !formData.api_key}
              className="btn-secondary flex-1"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
