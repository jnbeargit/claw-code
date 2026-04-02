# Design Reference - Visual Guide

## Color Reference

### Background Colors
```css
--bg-main: #292922        /* Main app background */
--bg-sidebar: #1F1F1A     /* Sidebar background */
--bg-card: #353530        /* Cards, inputs */
--bg-hover: #3A3A34       /* Hover states */
```

### Border Colors
```css
--border: #3D3D37         /* All borders */
```

### Text Colors
```css
--text-primary: #E8E4DF   /* Primary text */
--text-secondary: #9B9790 /* Muted text */
--text-tertiary: #6B6860  /* Very muted */
```

### Accent Colors
```css
--accent-blue: #4A9EFF    /* Active indicators */
--accent-green: #4ADE80   /* Connected status */
```

## Component Anatomy

### Sidebar (260px)
```
┌─────────────────────────────┐
│ + New chat                  │ ← 36px height, 12px padding
│ 🔍 Search                   │
│ 📁 Workspaces               │
│ ⚙️ Settings                 │
├─────────────────────────────┤ ← Divider
│ RECENTS                     │ ← 12px uppercase
│ • Current session           │ ← Blue dot for active
│                             │
│                             │ ← Scrollable area
│                             │
├─────────────────────────────┤
│ Connect MCP servers...      │ ← Small note
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ [YD] Yotta Digital      │ │ ← Workspace card
│ │ • Connected             │ │
│ │                      ˅  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Top Bar (48px)
```
┌──────────────────────────────────────────────────────┐
│ [□]          Yotta Digital                           │
│  ↑              ↑                                     │
│  Toggle      Workspace name                          │
└──────────────────────────────────────────────────────┘
```

### Home Screen
```
         ✨ What would you like to build?
         Connected to Yotta Digital via MCP

┌──────────────────────────────────────────────┐
│ How can I help you today?                   │ ← Auto-resize textarea
│                                              │
├──────────────────────────────────────────────┤
│ • Connected to MCP    Claude 3.5 Sonnet [▲] │ ← Bottom row
└──────────────────────────────────────────────┘

                 134 tools available
```

### Chat View
```
┌──────────────────────────────────────────┐
│                                          │ ← Scrollable
│  User message in card background  ───┐  │
│                                          │
│  [AI] Assistant response             │  │ ← Left-aligned
│                                          │
│  ┌────────────────────────────────┐   │
│  │ 🔧 read_file               ✓   │   │ ← Tool card
│  │ Success                        │   │
│  │ [expand to see input/output]   │   │
│  └────────────────────────────────┘   │
│                                          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Type a message...                        │ ← Fixed bottom
│ ─────────────────────────────────────────│
│ • Yotta Digital    Claude 3.5 Sonnet [▲]│
└──────────────────────────────────────────┘
```

### Workspace Setup Modal
```
            ┌──────────────────────┐
            │ New Workspace    [✕] │
            ├──────────────────────┤
            │                      │
            │ Workspace Name       │
            │ [Input field]        │
            │                      │
            │ MCP Server URL       │
            │ [Input field]        │
            │                      │
            │ MCP API Key          │
            │ [••••••••]           │
            │                      │
            │ LLM Provider         │
            │ [Dropdown]           │
            │                      │
            │ Model                │
            │ [Input field]        │
            │                      │
            │ Anthropic API Key    │
            │ [••••••••]           │
            │                      │
            │ [Test]    [Save]     │ ← Buttons
            │                      │
            │     Cancel           │ ← Link
            └──────────────────────┘
```

## Spacing System

### Padding
- **Small:** 12px (p-3)
- **Medium:** 16px (p-4)
- **Large:** 20px (p-5)
- **XLarge:** 24px (p-6)

### Gaps
- **Nav items:** 12px
- **Form fields:** 20px
- **Messages:** 24px

### Border Radius
- **Small:** 6px (rounded-md)
- **Medium:** 8px (rounded-lg)
- **Large:** 16px (rounded-2xl)
- **Circle:** 50% (rounded-full)

## Typography Scale

### Sizes
- **Hero:** 36px (text-4xl)
- **Heading 1:** 24px (text-2xl)
- **Heading 2:** 18px (text-lg)
- **Body:** 15px (chat text)
- **UI:** 14px (text-sm)
- **Small:** 12px (text-xs)

### Weights
- **Semibold:** 600 (font-semibold)
- **Medium:** 500 (font-medium)
- **Regular:** 400 (default)

## Icon Sizes

### Standard Sizes
- **Nav icons:** 16px (w-4 h-4)
- **Avatar text:** 12px
- **Tool icons:** 16px (w-4 h-4)
- **Chevrons:** 16px (w-4 h-4)
- **Send button:** 16px (w-4 h-4)

## Animation Timings

### Transitions
- **Default:** 200ms (transition-colors)
- **Slide up:** 300ms ease-out
- **Fade in:** 200ms ease-in

## States

### Interactive Elements
```
Default  → hover:bg-hover
Active   → bg-hover + border-l-2 border-accent-blue
Disabled → opacity-30
```

### Connection Status
```
Connected    → • green (#4ADE80)
Disconnected → • gray (#6B6860)
Pending      → • blue (#4A9EFF) + spin
```

### Tool Status
```
Success → ✓ green
Error   → ✕ red
Pending → ⟳ blue + spin
```

## Accessibility

### Contrast Ratios
- Primary text on main bg: 7.8:1 ✓
- Secondary text on main bg: 4.8:1 ✓
- Tertiary text on main bg: 3.2:1 ✓
- Border on main bg: 2.1:1 (decorative)

### Focus States
All interactive elements have visible focus rings using `focus:ring-1 focus:ring-border`

## Responsive Behavior

### Sidebar
- Fixed width on desktop (260px)
- Toggleable with button
- Collapses to overlay on small screens (future)

### Main Content
- Max-width 800px, centered
- Padding on sides for small screens
- Chat messages max-width 720px

### Input Areas
- Min 1 line, max 6 lines auto-resize
- Fixed height send button (32px circle)
- Flexible textarea height

## Best Practices

1. **Always use Tailwind classes** - avoid inline styles
2. **Use semantic color names** - `bg-bg-card` not `#353530`
3. **Consistent spacing** - stick to padding scale
4. **Icon consistency** - lucide-react, same sizes
5. **Animation sparingly** - only on state changes
6. **Maintain warmth** - never use pure grays
7. **Test contrast** - verify text readability
8. **Mobile-first** - design for small screens
