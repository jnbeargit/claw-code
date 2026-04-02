# Norg Desktop Frontend Redesign

## Overview
Complete visual redesign of the Norg Desktop React frontend to match Claude Desktop/Cowork aesthetic. All files have been rewritten while preserving all existing Tauri functionality.

## Design System

### Color Palette (Warm Dark Theme)
- **Main background:** `#292922` (warm dark olive-charcoal)
- **Sidebar background:** `#1F1F1A` (slightly darker)
- **Card/input backgrounds:** `#353530` (subtle lift)
- **Card borders:** `#3D3D37`
- **Text primary:** `#E8E4DF` (warm off-white)
- **Text secondary/muted:** `#9B9790`
- **Text tertiary:** `#6B6860`
- **Accent blue:** `#4A9EFF` (active indicators)
- **Accent green:** `#4ADE80` (connected status)
- **Hover states:** `#3A3A34`

### Typography
- **Body/UI:** System font stack (14px base)
- **Large headings:** Georgia serif, italic (36px for hero)
- **Chat text:** 15px with 1.6 line-height
- **Nav items:** 14px, weight 400
- **Muted labels:** 12px, uppercase tracking

### Layout
- **Sidebar:** Fixed 260px width
- **Main content:** Centered, max-width 800px
- **Top bar:** 48px height with macOS drag region
- **Messages:** Max-width 720px, centered

## Files Modified

### Configuration
1. **tailwind.config.js** - Added custom warm color palette
2. **index.html** - Added dark mode meta tags and body styling

### Core Styles
3. **app/index.css** - Complete rewrite with:
   - Warm dark theme utilities
   - Custom scrollbar styling
   - Nav item, input, button, card components
   - Message bubble styles
   - Animation utilities (fade-in, slide-up)

### Components (All Completely Rewritten)
4. **app/App.tsx** - Main layout with:
   - Sidebar toggle
   - Top bar with workspace name
   - View management (home, chat, settings)
   - Workspace selection and setup
   - MCP auto-connection

5. **app/components/WorkspaceSidebar.tsx** - Left sidebar with:
   - Navigation items (New chat, Search, Workspaces, Settings)
   - Recent chats section
   - Workspace info card at bottom
   - Workspace switcher dropdown
   - Connection status indicator

6. **app/components/WorkspaceSetup.tsx** - Modal for workspace config:
   - Centered modal design
   - Form fields for MCP and LLM settings
   - Test connection button
   - Save/cancel actions

7. **app/components/Chat.tsx** - Dual-mode chat interface:
   - **Home view:** Hero text, centered input card, tools count
   - **Chat view:** Message stack with bottom input bar
   - Auto-scrolling
   - Streaming indicator
   - Connection badge

8. **app/components/MessageBubble.tsx** - Message rendering:
   - User messages: right-aligned, card background
   - Assistant messages: left-aligned with avatar
   - Tool calls integration

9. **app/components/ToolPanel.tsx** - Collapsible tool call display:
   - Tool name and status icon
   - Expandable input/output
   - Status indicators (pending/success/error)

10. **app/components/Settings.tsx** - Settings panel:
    - Workspace details display
    - Edit workspace button
    - About section

### Hooks (Preserved - No Changes)
11. **app/hooks/useWorkspaces.ts** - Workspace CRUD operations
12. **app/hooks/useMcp.ts** - MCP connection management
13. **app/hooks/useChat.ts** - Chat messaging and streaming

### Types (Preserved - No Changes)
14. **app/types/index.ts** - TypeScript interfaces

## Key Features

### Warm Aesthetic
- Olive-charcoal undertones instead of blue-gray
- Professional, premium feel
- Consistent with high-end design tools

### macOS Integration
- Top bar with drag region (`data-tauri-drag-region`)
- Sidebar toggle button
- Native feel with system fonts

### MCP Integration
- Auto-connect on workspace selection
- Connection status indicators
- Tools count display
- Tool call visualization

### Chat Experience
- Home screen with hero text
- Smooth transition to chat view
- Streaming text animation
- Message grouping
- Auto-scrolling

### Workspace Management
- Visual workspace switcher
- Colored avatars with initials
- Connection status
- Quick switching

## Testing

TypeScript compilation passes without errors:
```bash
npx tsc --noEmit
```

## Preserved Functionality

All existing Tauri invoke calls and event listeners remain intact:
- `list_workspaces`
- `create_workspace`
- `update_workspace`
- `delete_workspace`
- `mcp_connect`
- `mcp_disconnect`
- `mcp_list_tools`
- `chat_send_message`
- `chat_get_history`
- `chat_clear_history`

Event listeners:
- `chat-stream-delta:${sessionId}`
- `chat-complete:${sessionId}`
- `chat-error:${sessionId}`
- `chat-tool-use:${sessionId}` (in hooks)
- `chat-tool-result:${sessionId}` (in hooks)

## Development

To run the app:
```bash
npm run dev
```

To build:
```bash
npm run tauri build
```

## Notes

- All visual changes only - no business logic altered
- Lucide React icons used throughout
- Tailwind CSS with custom theme
- Responsive textarea with auto-resize
- Smooth animations and transitions
- Accessible color contrast maintained
- Dark mode optimized for extended use

## Next Steps

1. Test with actual Tauri backend
2. Verify MCP connection flow
3. Test chat streaming
4. Validate tool calls display
5. Check workspace CRUD operations
6. Test on different screen sizes
