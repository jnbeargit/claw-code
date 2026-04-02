import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Workspace } from '@/types';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const result = await invoke<Workspace[]>('list_workspaces');
      setWorkspaces(result);
      setError(null);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const createWorkspace = async (data: {
    name: string;
    mcp_url: string;
    api_key: string;
    llm_provider: string;
    llm_api_key: string;
    llm_model: string;
  }) => {
    try {
      const workspace = await invoke<Workspace>('create_workspace', data);
      setWorkspaces((prev) => [...prev, workspace]);
      return workspace;
    } catch (err) {
      throw new Error(err as string);
    }
  };

  const updateWorkspace = async (
    id: string,
    data: {
      name: string;
      mcp_url: string;
      api_key: string;
      llm_provider: string;
      llm_api_key: string;
      llm_model: string;
    }
  ) => {
    try {
      const workspace = await invoke<Workspace>('update_workspace', {
        id,
        ...data,
      });
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? workspace : w))
      );
      return workspace;
    } catch (err) {
      throw new Error(err as string);
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      await invoke('delete_workspace', { id });
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      throw new Error(err as string);
    }
  };

  const importBundle = async (llmConfig: {
    llm_provider: string;
    llm_api_key: string;
    llm_model: string;
  }) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'MCP Bundle', extensions: ['mcpb'] }],
    });

    if (!selected) return null;

    const filePath = typeof selected === 'string' ? selected : selected;
    try {
      const result = await invoke<{
        workspace: Workspace;
        display_name: string;
        description: string;
        tool_count: number | null;
      }>('import_mcpb_bundle', {
        filePath: filePath,
        llmProvider: llmConfig.llm_provider,
        llmApiKey: llmConfig.llm_api_key,
        llmModel: llmConfig.llm_model,
      });
      setWorkspaces((prev) => [...prev, result.workspace]);
      return result;
    } catch (err) {
      throw new Error(err as string);
    }
  };

  const peekBundle = async (filePath: string) => {
    return invoke<{
      name: string;
      display_name: string;
      description: string;
      version: string;
      mcp_url: string;
    }>('peek_mcpb_bundle', { filePath });
  };

  return {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    importBundle,
    peekBundle,
    reload: loadWorkspaces,
  };
}
