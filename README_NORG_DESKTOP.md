# Norg Desktop

A multi-workspace AI chat client built with Tauri v2, React, and TypeScript. Connect to Norg's MCP (Model Context Protocol) servers and bring your own LLM API key (Anthropic Claude or OpenAI).

## Architecture

### Backend (Rust)
- **Tauri v2**: Desktop application framework
- **Workspace Manager**: CRUD workspaces stored locally in `~/.norg-desktop/workspaces.json`
- **MCP Client**: HTTP/SSE transport for Norg MCP servers
- **Chat Engine**: Manages conversation sessions and tool-use loops
- **LLM Client**: Supports Anthropic (Claude) and OpenAI (GPT) with streaming

### Frontend (React + TypeScript)
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling (dark theme)
- **React Markdown**: Render assistant messages
- **Lucide React**: Icons

## Project Structure

```
claw-code/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Tauri command registration
│   │   ├── workspace.rs   # Workspace CRUD
│   │   ├── mcp_client.rs  # MCP HTTP client
│   │   ├── llm.rs         # LLM provider abstractions
│   │   └── chat.rs        # Chat engine with tool-use loop
│   ├── Cargo.toml
│   └── tauri.conf.json
├── app/                    # React frontend
│   ├── components/
│   │   ├── WorkspaceSidebar.tsx
│   │   ├── WorkspaceSetup.tsx
│   │   ├── Chat.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ToolPanel.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useWorkspaces.ts
│   │   ├── useMcp.ts
│   │   └── useChat.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── rust/                   # Original claw-code Rust crates (preserved)
├── src/                    # Original Python source (preserved)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Prerequisites

- **Rust**: Install via [rustup](https://rustup.rs/)
- **Node.js**: v18+ recommended
- **Norg Account**: Get API key and MCP endpoint URL

## Installation

```bash
# Clone or navigate to the project
cd /Users/jackbear/clawd/claw-code

# Install frontend dependencies
npm install

# Build frontend
npm run build

# Build Rust backend (development)
cd src-tauri
cargo build

# Or build for release
cargo build --release
```

## Development

### Run dev server with hot reload:

```bash
# Start frontend dev server (port 5173)
npm run dev
```

In another terminal:

```bash
# Start Tauri app (watches Rust changes)
source "$HOME/.cargo/env"
npm run tauri dev
```

### Build production app:

```bash
npm run build
npm run tauri build
```

The compiled app will be in `src-tauri/target/release/`.

## Features

### Workspace Management
- Create multiple workspaces with different MCP endpoints
- Each workspace has its own:
  - MCP server URL and API key
  - LLM provider (Anthropic or OpenAI)
  - LLM model and API key
- Switch between workspaces instantly
- Edit or delete workspaces

### MCP Integration
- Connect to Norg MCP servers via HTTP/SSE transport
- List available tools from the MCP server
- Execute tool calls during conversations
- JSON-RPC 2.0 protocol over HTTP

### Chat Interface
- Stream responses in real-time
- Markdown rendering for assistant messages
- Tool call visualization:
  - Collapsible panels for each tool call
  - Show input/output JSON
  - Status indicators (pending, success, error)
- Persistent conversation history per session

### Tool Use Loop
1. User sends message
2. Backend sends to LLM with MCP tools as available tools
3. If LLM requests a tool:
   - Execute via MCP
   - Append result to conversation
   - Send back to LLM
4. Repeat until LLM returns text-only response
5. Stream everything to frontend via Tauri events

## Configuration

### Workspace JSON Structure

Stored at `~/.norg-desktop/workspaces.json`:

```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "mcp_url": "https://api.norg.ai/mcp",
      "api_key": "norg_xxxxxxxxxxxx",
      "llm_provider": "anthropic",
      "llm_api_key": "sk-ant-xxxx",
      "llm_model": "claude-sonnet-4",
      "created_at": "2026-04-02T08:57:00Z"
    }
  ]
}
```

### Tauri Config

See `src-tauri/tauri.conf.json` for:
- Window size/behavior
- Bundle settings
- Icon paths
- Dev/build commands

## API Reference

### Tauri Commands (Rust → Frontend)

#### Workspace Management
- `list_workspaces()` → `Vec<Workspace>`
- `create_workspace(name, mcp_url, api_key, llm_provider, llm_api_key, llm_model)` → `Workspace`
- `update_workspace(id, ...)` → `Workspace`
- `delete_workspace(id)` → `()`
- `get_workspace(id)` → `Workspace`

#### MCP Operations
- `mcp_connect(workspace_id, mcp_url, api_key)` → `()`
- `mcp_disconnect(workspace_id)` → `()`
- `mcp_list_tools(workspace_id)` → `Vec<McpTool>`
- `mcp_call_tool(workspace_id, tool_name, arguments)` → `Value`

#### Chat Operations
- `chat_send_message(workspace_id, session_id, message)` → `()`
- `chat_get_history(session_id)` → `Vec<ChatMessage>`
- `chat_clear_history(session_id)` → `()`
- `chat_list_sessions(workspace_id)` → `Vec<ChatSession>`

### Tauri Events (Rust → Frontend)

All events are namespaced by session ID:

- `chat-stream-delta:{session_id}` - Text chunks from LLM stream
- `chat-tool-use:{session_id}` - Tool call started
- `chat-tool-result:{session_id}` - Tool call completed
- `chat-complete:{session_id}` - Response finished
- `chat-error:{session_id}` - Error occurred

## Troubleshooting

### Frontend won't build
```bash
rm -rf node_modules dist
npm install
npm run build
```

### Rust won't compile
```bash
cd src-tauri
cargo clean
cargo build
```

### MCP connection fails
- Verify the MCP URL is correct (should be HTTP/HTTPS)
- Check the API key format (should be Bearer token)
- Test the endpoint manually: `curl -H "Authorization: Bearer <key>" <url>`

### Icons missing
Placeholder icons are in `src-tauri/icons/`. Replace with proper icons:
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.icns (macOS)
- icon.ico (Windows)

## License

MIT

## Credits

Built with:
- [Tauri](https://tauri.app/) - Desktop framework
- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Reqwest](https://github.com/seanmonstar/reqwest) - HTTP client
- [Tokio](https://tokio.rs/) - Async runtime
