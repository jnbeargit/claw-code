export interface Workspace {
  id: string;
  name: string;
  mcp_url: string;
  api_key: string;
  llm_provider: 'anthropic' | 'openai';
  llm_api_key: string;
  llm_model: string;
  created_at: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tool_calls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: any;
  output?: any;
  status: 'pending' | 'success' | 'error';
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  messages: ChatMessage[];
  created_at: number;
}
