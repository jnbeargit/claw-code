import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { McpTool } from '@/types';

export function useMcp(workspaceId: string | null) {
  const [connected, setConnected] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (mcpUrl: string, apiKey: string) => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      setError(null);
      await invoke('mcp_connect', {
        workspaceId,
        mcpUrl,
        apiKey,
      });
      setConnected(true);
      
      // Load tools
      const toolList = await invoke<McpTool[]>('mcp_list_tools', {
        workspaceId,
      });
      setTools(toolList);
    } catch (err) {
      setError(err as string);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!workspaceId) return;
    
    try {
      await invoke('mcp_disconnect', { workspaceId });
      setConnected(false);
      setTools([]);
    } catch (err) {
      setError(err as string);
    }
  };

  const refreshTools = async () => {
    if (!workspaceId || !connected) return;
    
    try {
      const toolList = await invoke<McpTool[]>('mcp_list_tools', {
        workspaceId,
      });
      setTools(toolList);
    } catch (err) {
      setError(err as string);
    }
  };

  return {
    connected,
    tools,
    loading,
    error,
    connect,
    disconnect,
    refreshTools,
  };
}
