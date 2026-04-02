import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

  return {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    reload: loadWorkspaces,
  };
}
