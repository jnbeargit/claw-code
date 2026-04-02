import { useState } from 'react';
import { FileUp, Loader2, Check, Package } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { Workspace } from '@/types';

interface ImportBundleProps {
  onImported: (workspace: Workspace) => void;
  onCancel: () => void;
}

interface BundleInfo {
  name: string;
  display_name: string;
  description: string;
  version: string;
  mcp_url: string;
}

interface ModelInfo {
  id: string;
  name: string;
}

export function ImportBundle({ onImported, onCancel }: ImportBundleProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [bundleInfo, setBundleInfo] = useState<BundleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [llmConfig, setLlmConfig] = useState({
    llm_provider: 'anthropic',
    llm_api_key: '',
    llm_model: '',
  });

  const handleSelectFile = async () => {
    setError(null);
    const selected = await open({
      multiple: false,
      filters: [{ name: 'MCP Bundle', extensions: ['mcpb'] }],
    });

    if (!selected) return;

    const path = typeof selected === 'string' ? selected : selected;
    setFilePath(path);
    setLoading(true);

    try {
      const info = await invoke<BundleInfo>('peek_mcpb_bundle', { filePath: path });
      setBundleInfo(info);
    } catch (err) {
      setError(err as string);
      setBundleInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath) return;

    setImporting(true);
    setError(null);

    try {
      const result = await invoke<{
        workspace: Workspace;
        display_name: string;
        description: string;
        tool_count: number | null;
      }>('import_mcpb_bundle', {
        filePath,
        llmProvider: llmConfig.llm_provider,
        llmApiKey: llmConfig.llm_api_key,
        llmModel: llmConfig.llm_model,
      });

      onImported(result.workspace);
    } catch (err) {
      setError(err as string);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-[500px] bg-bg-card border border-border rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-semibold">Import MCP Bundle</h2>
          </div>
        </div>

        <form onSubmit={handleImport} className="p-6 space-y-5">
          {/* File Picker */}
          {!bundleInfo ? (
            <button
              type="button"
              onClick={handleSelectFile}
              disabled={loading}
              className="w-full border-2 border-dashed border-border hover:border-text-tertiary rounded-xl p-8 flex flex-col items-center gap-3 transition-colors group"
            >
              {loading ? (
                <Loader2 className="w-8 h-8 text-text-tertiary animate-spin" />
              ) : (
                <FileUp className="w-8 h-8 text-text-tertiary group-hover:text-text-secondary transition-colors" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">
                  {loading ? 'Reading bundle...' : 'Select .mcpb file'}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  MCP bundle files contain connection details for a Norg workspace
                </p>
              </div>
            </button>
          ) : (
            /* Bundle Info Card */
            <div className="bg-bg-main border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-accent-green" />
                <span className="text-sm font-medium text-accent-green">Bundle loaded</span>
              </div>
              <h3 className="text-base font-semibold text-text-primary">
                {bundleInfo.display_name || bundleInfo.name}
              </h3>
              {bundleInfo.description && (
                <p className="text-xs text-text-secondary line-clamp-2">
                  {bundleInfo.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-text-tertiary pt-1">
                {bundleInfo.version && <span>v{bundleInfo.version}</span>}
                <span className="truncate">{bundleInfo.mcp_url}</span>
              </div>
              <button
                type="button"
                onClick={() => { setBundleInfo(null); setFilePath(null); }}
                className="text-xs text-accent-blue hover:underline mt-1"
              >
                Choose different file
              </button>
            </div>
          )}

          {/* LLM Config - only show after bundle selected */}
          {bundleInfo && (
            <>
              <div className="border-t border-border pt-5">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-4">
                  LLM Configuration
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      LLM Provider
                    </label>
                    <select
                      value={llmConfig.llm_provider}
                      onChange={(e) => setLlmConfig(prev => ({ ...prev, llm_provider: e.target.value }))}
                      className="input-field"
                    >
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="openai">OpenAI (GPT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      {llmConfig.llm_provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
                    </label>
                    <input
                      type="password"
                      value={llmConfig.llm_api_key}
                      onChange={(e) => {
                        const key = e.target.value;
                        setLlmConfig(prev => ({ ...prev, llm_api_key: key }));
                        setModels([]);
                        setLlmConfig(prev => ({ ...prev, llm_api_key: key, llm_model: '' }));
                      }}
                      onBlur={async () => {
                        if (llmConfig.llm_api_key.length > 10) {
                          setLoadingModels(true);
                          try {
                            const result = await invoke<{ models: ModelInfo[] }>('list_models', {
                              provider: llmConfig.llm_provider,
                              apiKey: llmConfig.llm_api_key,
                            });
                            setModels(result.models);
                            if (result.models.length > 0 && !llmConfig.llm_model) {
                              setLlmConfig(prev => ({ ...prev, llm_model: result.models[0].id }));
                            }
                          } catch (err) {
                            setError(`Invalid API key: ${err}`);
                          } finally {
                            setLoadingModels(false);
                          }
                        }
                      }}
                      placeholder="sk-..."
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Model {loadingModels && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                    </label>
                    {models.length > 0 ? (
                      <select
                        value={llmConfig.llm_model}
                        onChange={(e) => setLlmConfig(prev => ({ ...prev, llm_model: e.target.value }))}
                        className="input-field"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={llmConfig.llm_model}
                        onChange={(e) => setLlmConfig(prev => ({ ...prev, llm_model: e.target.value }))}
                        placeholder={llmConfig.llm_provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4'}
                        className="input-field"
                      />
                    )}
                    <p className="text-xs text-text-tertiary mt-1">
                      {models.length > 0 ? `${models.length} models detected` : 'Enter API key to auto-detect models'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {bundleInfo && (
              <button
                type="submit"
                disabled={importing || !llmConfig.llm_api_key}
                className="btn-primary flex-1"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Importing...
                  </>
                ) : (
                  'Import & Connect'
                )}
              </button>
            )}
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
