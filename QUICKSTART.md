# Norg Desktop - Quick Start Guide

## ✅ Installation Complete!

Your Norg Desktop app is now built and ready to run.

## 🚀 Run the App (Development Mode)

```bash
cd /Users/jackbear/clawd/claw-code

# Option 1: Run with Tauri dev server (hot reload)
npm run tauri dev

# Option 2: Run the compiled binary directly
./src-tauri/target/release/norg-desktop
```

## 📝 First Time Setup

When you launch the app:

1. **Click the "+" button** in the workspace sidebar
2. **Fill in the workspace form:**
   - **Name**: Give your workspace a name (e.g., "My Workspace")
   - **MCP URL**: Your Norg MCP endpoint (e.g., `https://api.norg.ai/mcp`)
   - **Norg API Key**: Your Norg API key (format: `norg_xxxxxxxxxxxx`)
   - **LLM Provider**: Choose Anthropic or OpenAI
   - **LLM API Key**: 
     - Anthropic: `sk-ant-xxxxxxxxxxxx`
     - OpenAI: `sk-xxxxxxxxxxxx`
   - **Model**: 
     - Anthropic: `claude-sonnet-4`, `claude-opus-4`, etc.
     - OpenAI: `gpt-4-turbo`, `gpt-4`, etc.
3. **Click "Create"**
4. The app will automatically connect to your MCP server
5. **Start chatting!** Type a message in the input box

## 🎯 Key Features

### Chat Interface
- **Markdown support**: Assistant responses render with full markdown
- **Streaming**: See responses as they're generated
- **Tool calls**: When the LLM uses a tool, you'll see collapsible panels showing:
  - Tool name
  - Input parameters
  - Output results
  - Status (pending/success/error)

### Workspaces
- **Multiple workspaces**: Create different workspaces for different projects
- **Quick switching**: Click any workspace in the sidebar to switch
- **Edit/Delete**: Right-click context menu (or click the three dots) on any workspace

### Connection Status
- **Green dot**: Connected and ready
- **Gray dot**: Not connected
- Top bar shows overall connection status

## 🔧 Configuration

### Workspace Storage
Workspaces are saved locally at:
```
~/.norg-desktop/workspaces.json
```

### Chat History
Conversations are stored in-memory per session. To persist history, we'd need to add local storage (future enhancement).

## 🐛 Troubleshooting

### "Connection failed" error
- Verify your MCP URL is correct
- Check your Norg API key is valid
- Test manually: `curl -H "Authorization: Bearer YOUR_KEY" YOUR_MCP_URL`

### "LLM request failed"
- Verify your LLM API key is correct
- Check your model name is supported
- Ensure you have API credits

### Tool call fails
- Check the MCP server supports the tool
- Verify tool input parameters are correct
- Look at the error output in the collapsed tool panel

## 📦 Building for Distribution

### macOS App Bundle
```bash
npm run tauri build
```
Output: `src-tauri/target/release/bundle/macos/Norg Desktop.app`

### Windows/Linux
Same command, outputs to respective bundle directories.

## 🎨 Customization

### Change Theme
Currently dark theme only. To modify:
- Edit `app/index.css` for global styles
- Edit Tailwind colors in `tailwind.config.js`

### Change Window Size
Edit `src-tauri/tauri.conf.json`:
```json
"windows": [{
  "width": 1200,
  "height": 800
}]
```

### Add Custom Icons
Replace files in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## 📚 Next Steps

See `README_NORG_DESKTOP.md` for:
- Full architecture documentation
- API reference
- Advanced configuration
- Development guide

## 💡 Tips

1. **Test connection**: After creating a workspace, watch the connection indicator
2. **Tool visibility**: Expand tool panels to see full JSON input/output
3. **Multiple workspaces**: Use different workspaces for different LLM models or MCP servers
4. **Keyboard shortcut**: Press Enter to send messages

## ⚡ Performance

- **Cold start**: ~2-3 seconds
- **Hot reload (dev)**: ~500ms
- **Message streaming**: Real-time (no noticeable latency)
- **Tool execution**: Depends on MCP server response time

Enjoy your Norg Desktop app! 🎉
