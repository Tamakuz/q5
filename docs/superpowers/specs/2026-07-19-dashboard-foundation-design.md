# Dashboard Foundation — Design Spec

**Date:** 2026-07-19
**Status:** Draft
**Goal:** Build a single-page dashboard UI as the control center for the content-auto workflow (Build → Preview → Render → Export), with sidebar-driven step navigation and placeholder content areas.

---

## 1. Overview

A single-page React dashboard (Vite SPA) that lives alongside the Remotion engine in a monorepo. The sidebar controls which workflow step's placeholder content is shown. No routing — pure `useState`-based step switching.

### 1.1 Monorepo structure

```
content-auto/
├── dashboard/                  # Vite + React + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── placeholders/
│   │   │       ├── BuildPlaceholder.tsx
│   │   │       ├── PreviewPlaceholder.tsx
│   │   │       ├── RenderPlaceholder.tsx
│   │   │       └── ExportPlaceholder.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.ts
├── src/                        # Existing Remotion engine
├── input/
├── output/
├── package.json                # Root: npm workspaces
└── ...
```

---

## 2. Layout

```
┌──────────────────────────────────────────────────────┐
│  Content Auto                              v0.1.0    │  ← TopBar
├────────┬─────────────────────────────────────────────┤
│  📝    │                                             │
│ Build  │          Placeholder Content                │  ← Sidebar + Content
│        │          (per active step)                   │
│  👁    │                                             │
│Preview │                                             │
│        │                                             │
│  🎬    │                                             │
│ Render │                                             │
│        │                                             │
│  📦    │                                             │
│ Export │                                             │
│        │                                             │
├────────┴─────────────────────────────────────────────┤
│  ● Ready                                             │  ← StatusBar
└──────────────────────────────────────────────────────┘
```

- **TopBar:** Title "Content Auto" + version badge (optional settings/help later)
- **Sidebar (w-64):** 4 workflow step buttons, active state = highlighted bg
- **Content (flex-1):** Renders one placeholder at a time
- **StatusBar (h-8):** Small green dot + text "Ready"

---

## 3. Component Tree & Data Flow

```
App (state: activeStep, status)
├── TopBar
├── div.flex
│   ├── Sidebar
│   │   └── StepItem (×4)
│   └── Content
│       └── {Placeholder per activeStep}
└── StatusBar
```

**State (in App):**
- `activeStep: 'build' | 'preview' | 'render' | 'export'` — default `'build'`
- `status: 'ready' | 'rendering' | 'error'` — default `'ready'`

Sidebar calls `setActiveStep` on click. Content reads `activeStep` and renders the matching placeholder.

---

## 4. Placeholders

Each placeholder is a centered card with icon + title + descriptive text. No functionality yet — purely visual foundation.

| Step | Icon | Title | Description |
|---|---|---|---|
| Build | 📝 | Scene Builder | Create and edit scene JSON with visual tools |
| Preview | 👁 | Live Preview | Preview your video composition in real-time |
| Render | 🎬 | Render Queue | Start and manage video render jobs |
| Export | 📦 | Export | Download rendered videos or push to platforms |

---

## 5. Styling

- **Tailwind CSS** for all styling
- Dark theme (matches engine vibe): background `gray-950`, sidebar `gray-900`, cards `gray-800`, text `white/gray-400`
- Active step: `bg-indigo-600` highlight
- Hover step: `bg-gray-800`
- Clean, minimal — no unnecessary decorations

---

## 6. Tech Stack

| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI components |
| `vite` | Build tool & dev server |
| `tailwindcss` + `postcss` + `autoprefixer` | Utility-first CSS |
| `typescript` | Type safety |

---

## 7. Workspace Integration

Root `package.json` uses npm workspaces:
```json
{
  "workspaces": ["dashboard"]
}
```

Run dashboard dev server:
```bash
npm run dev -w dashboard
```

---

## 8. Out of Scope

- Routing (no react-router needed — single page)
- Backend/API integration
- Actual JSON editing, preview rendering, render job management
- Settings or help modals
- Authentication
- Responsive/mobile layout (desktop-first tool)

---

## 9. Success Criteria

- [ ] `npm run dev -w dashboard` starts Vite dev server
- [ ] Dashboard renders: TopBar + Sidebar (4 steps) + Content (placeholder) + StatusBar
- [ ] Clicking sidebar steps switches the placeholder content
- [ ] Active step is visually highlighted
- [ ] Dark theme applied throughout
