# Dashboard Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page dashboard UI (Vite + React + Tailwind) with sidebar-driven workflow step navigation and placeholder content areas, integrated into the monorepo.

**Architecture:** Pure client-side React SPA with `useState`-based step switching (no router). Tailwind CSS dark theme. Monorepo via npm workspaces.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS v3, npm workspaces

## Global Constraints

- Single page only — no routing, no react-router
- Sidebar step switching via `useState<'build' | 'preview' | 'render' | 'export'>`
- Dark theme: gray-950 bg, gray-900 sidebar, gray-800 cards, white/gray-400 text
- Active step highlight: indigo-600
- Desktop-first (no responsive required)
- All content areas are placeholders — no real functionality
- Lives in `dashboard/` subdirectory, npm workspace

---

## File Structure Map

```
content-auto/
├── dashboard/
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
├── package.json          # MODIFY: add "workspaces": ["dashboard"]
└── ...
```

| File | Responsibility |
|---|---|
| `dashboard/package.json` | Dashboard dependencies: react, react-dom, vite, tailwindcss, postcss, autoprefixer, typescript, @vitejs/plugin-react |
| `dashboard/vite.config.ts` | Vite config with React plugin |
| `dashboard/tailwind.config.js` | Tailwind content paths |
| `dashboard/postcss.config.js` | PostCSS with tailwind + autoprefixer |
| `dashboard/tsconfig.json` | Dashboard-specific TS config |
| `dashboard/index.html` | Vite HTML entry |
| `dashboard/src/index.css` | Tailwind directives (`@tailwind base/components/utilities`) |
| `dashboard/src/App.css` | App-level custom styles (minimal) |
| `dashboard/src/main.tsx` | ReactDOM.createRoot entry |
| `dashboard/src/App.tsx` | Root component: state for activeStep + status, layout shell |
| `dashboard/src/components/TopBar.tsx` | Header bar: title + version |
| `dashboard/src/components/Sidebar.tsx` | 4 step items, emits onStepChange, receives activeStep |
| `dashboard/src/components/StatusBar.tsx` | Footer bar: status dot + text |
| `dashboard/src/components/placeholders/*.tsx` | 4 centered placeholder cards |

---

### Task 1: Scaffold dashboard project with Vite + Tailwind

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tailwind.config.js`
- Create: `dashboard/postcss.config.js`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/index.html`
- Create: `dashboard/src/index.css`
- Create: `dashboard/src/App.css`
- Create: `dashboard/src/main.tsx`
- Create: directory structure: `dashboard/src/components/`, `dashboard/src/components/placeholders/`
- Modify: `package.json` (root — add workspaces)

**Interfaces:**
- Consumes: nothing
- Produces: runnable Vite dev server with Tailwind, npm workspace integration

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p dashboard/src/components/placeholders
```

- [ ] **Step 2: Write dashboard/package.json**

```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 3: Update root package.json to add workspaces**

Read the root `package.json`, then add `"workspaces": ["dashboard"]` to it:

```json
{
  "name": "content-auto",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["dashboard"],
  "description": "Remotion-based automated content rendering engine for YouTube",
  "scripts": {
    "build": "tsc --noEmit",
    "render": "npx tsx cli.ts render",
    "validate": "npx tsx cli.ts validate"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "commander": "^12.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "remotion": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 4: Write dashboard/vite.config.ts**

```typescript
// dashboard/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 5: Write dashboard/tailwind.config.js**

```javascript
// dashboard/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 6: Write dashboard/postcss.config.js**

```javascript
// dashboard/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Write dashboard/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Write dashboard/index.html**

```html
<!doctype html>
<html lang="en" class="bg-gray-950">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Content Auto — Dashboard</title>
  </head>
  <body class="bg-gray-950 text-white min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Write dashboard/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Write dashboard/src/App.css (empty placeholder)**

```css
/* App-level custom styles — minimal, Tailwind handles most */
```

- [ ] **Step 11: Write dashboard/src/main.tsx (minimal — app renders but App is empty for now)**

```tsx
// dashboard/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 12: Install dependencies**

```bash
npm install
```
(Runs from root — npm workspaces installs both root + dashboard deps)

- [ ] **Step 13: Verify dev server starts**

Run: `npm run dev -w dashboard`

Expected: Vite starts on http://localhost:5173

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold dashboard with Vite + React + Tailwind

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Build TopBar and StatusBar components

**Files:**
- Create: `dashboard/src/components/TopBar.tsx`
- Create: `dashboard/src/components/StatusBar.tsx`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TopBar` — header bar with title and version badge
  - `StatusBar` — footer bar with status dot + text
    - Props: `{ status: 'ready' | 'rendering' | 'error' }`

- [ ] **Step 1: Write TopBar.tsx**

```tsx
// dashboard/src/components/TopBar.tsx
import React from 'react';

const TopBar: React.FC = () => {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-gray-900 border-b border-gray-800 shrink-0">
      <h1 className="text-lg font-semibold text-white tracking-tight">
        Content Auto
      </h1>
      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
        v0.1.0
      </span>
    </header>
  );
};

export default TopBar;
```

- [ ] **Step 2: Write StatusBar.tsx**

```tsx
// dashboard/src/components/StatusBar.tsx
import React from 'react';

interface StatusBarProps {
  status: 'ready' | 'rendering' | 'error';
}

const STATUS_CONFIG: Record<StatusBarProps['status'], { dot: string; label: string }> = {
  ready: { dot: 'bg-green-500', label: 'Ready' },
  rendering: { dot: 'bg-yellow-500 animate-pulse', label: 'Rendering...' },
  error: { dot: 'bg-red-500', label: 'Error' },
};

const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const config = STATUS_CONFIG[status];

  return (
    <footer className="flex items-center h-8 px-4 bg-gray-900 border-t border-gray-800 text-xs text-gray-400 shrink-0">
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${config.dot}`} />
      {config.label}
    </footer>
  );
};

export default StatusBar;
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit` (in dashboard dir, or `npm run build -w dashboard`)

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/TopBar.tsx dashboard/src/components/StatusBar.tsx
git commit -m "feat: add TopBar and StatusBar components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Build Sidebar component

**Files:**
- Create: `dashboard/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `Sidebar` component
  - Props: `{ activeStep: string; onStepChange: (step: StepId) => void }`
  - `StepId = 'build' | 'preview' | 'render' | 'export'`
  - Renders 4 `StepItem` sub-components with icon + label

- [ ] **Step 1: Write Sidebar.tsx**

```tsx
// dashboard/src/components/Sidebar.tsx
import React from 'react';

export type StepId = 'build' | 'preview' | 'render' | 'export';

interface Step {
  id: StepId;
  icon: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'build', icon: '📝', label: 'Build' },
  { id: 'preview', icon: '👁', label: 'Preview' },
  { id: 'render', icon: '🎬', label: 'Render' },
  { id: 'export', icon: '📦', label: 'Export' },
];

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStep, onStepChange }) => {
  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col py-4 shrink-0">
      {STEPS.map((step) => {
        const isActive = activeStep === step.id;
        return (
          <button
            key={step.id}
            onClick={() => onStepChange(step.id)}
            className={`
              flex items-center gap-3 px-5 py-3 mx-2 rounded-lg text-sm font-medium
              transition-colors duration-150 text-left
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }
            `}
          >
            <span className="text-lg">{step.icon}</span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default Sidebar;
```

- [ ] **Step 2: Verify types compile**

Run: `npm run build -w dashboard`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component with 4 workflow steps

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Build placeholder components

**Files:**
- Create: `dashboard/src/components/placeholders/BuildPlaceholder.tsx`
- Create: `dashboard/src/components/placeholders/PreviewPlaceholder.tsx`
- Create: `dashboard/src/components/placeholders/RenderPlaceholder.tsx`
- Create: `dashboard/src/components/placeholders/ExportPlaceholder.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: 4 placeholder components, each a centered card with icon + title + description

- [ ] **Step 1: Write BuildPlaceholder.tsx**

```tsx
// dashboard/src/components/placeholders/BuildPlaceholder.tsx
import React from 'react';

const BuildPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">📝</span>
        <h2 className="text-xl font-semibold text-white mb-2">Scene Builder</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Create and edit scene JSON with visual tools. Add text, images, animations, and transitions.
        </p>
      </div>
    </div>
  );
};

export default BuildPlaceholder;
```

- [ ] **Step 2: Write PreviewPlaceholder.tsx**

```tsx
// dashboard/src/components/placeholders/PreviewPlaceholder.tsx
import React from 'react';

const PreviewPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">👁</span>
        <h2 className="text-xl font-semibold text-white mb-2">Live Preview</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Preview your video composition in real-time as you build. See text, images, and animations come to life.
        </p>
      </div>
    </div>
  );
};

export default PreviewPlaceholder;
```

- [ ] **Step 3: Write RenderPlaceholder.tsx**

```tsx
// dashboard/src/components/placeholders/RenderPlaceholder.tsx
import React from 'react';

const RenderPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">🎬</span>
        <h2 className="text-xl font-semibold text-white mb-2">Render Queue</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Start and manage video render jobs. Track progress, view history, and configure output settings.
        </p>
      </div>
    </div>
  );
};

export default RenderPlaceholder;
```

- [ ] **Step 4: Write ExportPlaceholder.tsx**

```tsx
// dashboard/src/components/placeholders/ExportPlaceholder.tsx
import React from 'react';

const ExportPlaceholder: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8 rounded-xl bg-gray-800/50 border border-gray-700">
        <span className="text-5xl block mb-4">📦</span>
        <h2 className="text-xl font-semibold text-white mb-2">Export</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Download rendered videos or push directly to YouTube and other platforms.
        </p>
      </div>
    </div>
  );
};

export default ExportPlaceholder;
```

- [ ] **Step 5: Verify types compile**

Run: `npm run build -w dashboard`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/placeholders/
git commit -m "feat: add 4 workflow placeholder components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Wire up App.tsx — full layout assembly

**Files:**
- Create/Overwrite: `dashboard/src/App.tsx` (replace the placeholder from Task 1)
- Modify: `dashboard/src/App.css` (final styles if needed)

**Interfaces:**
- Consumes: TopBar, Sidebar, StatusBar, BuildPlaceholder, PreviewPlaceholder, RenderPlaceholder, ExportPlaceholder, StepId from Sidebar
- Produces: Complete App component with state management and layout

- [ ] **Step 1: Write App.tsx**

```tsx
// dashboard/src/App.tsx
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import type { StepId } from './components/Sidebar';
import StatusBar from './components/StatusBar';
import BuildPlaceholder from './components/placeholders/BuildPlaceholder';
import PreviewPlaceholder from './components/placeholders/PreviewPlaceholder';
import RenderPlaceholder from './components/placeholders/RenderPlaceholder';
import ExportPlaceholder from './components/placeholders/ExportPlaceholder';

type Status = 'ready' | 'rendering' | 'error';

const PLACEHOLDERS: Record<StepId, React.FC> = {
  build: BuildPlaceholder,
  preview: PreviewPlaceholder,
  render: RenderPlaceholder,
  export: ExportPlaceholder,
};

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('build');
  const [status] = useState<Status>('ready');

  const ActivePlaceholder = PLACEHOLDERS[activeStep];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeStep={activeStep} onStepChange={setActiveStep} />
        <main className="flex-1 p-6 overflow-auto">
          <ActivePlaceholder />
        </main>
      </div>
      <StatusBar status={status} />
    </div>
  );
};

export default App;
```

- [ ] **Step 2: Verify types compile**

Run: `npm run build -w dashboard`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/App.tsx
git commit -m "feat: wire up App layout with sidebar-driven step switching

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: End-to-end validation

**Files:**
- No new files — verify the full stack works together

**Interfaces:**
- Consumes: everything from Tasks 1-5
- Produces: verified working dashboard

- [ ] **Step 1: Verify TypeScript compilation**

Run: `npm run build -w dashboard`

Expected: no type errors.

- [ ] **Step 2: Start dev server and verify visually**

Run:
```bash
npm run dev -w dashboard
```

Open http://localhost:5173 and verify:
- TopBar shows "Content Auto" with v0.1.0 badge
- Sidebar shows 4 steps (Build, Preview, Render, Export)
- Build is active by default (indigo-600 highlight)
- Main area shows "📝 Scene Builder" placeholder card
- StatusBar shows green dot + "Ready"
- Clicking other sidebar steps switches the placeholder
- Dark theme throughout (gray-950 bg, gray-900 sidebar)

- [ ] **Step 3: Verify Remotion engine still works**

Run:
```bash
npx tsx cli.ts validate input/sample.json
```

Expected: same output as before (workspaces don't break existing engine).

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: final verification — dashboard rendering end-to-end

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Single page, no routing | Task 5 (useState, no react-router) |
| Sidebar with 4 workflow steps | Task 3 |
| Active step highlighted | Task 3 (indigo-600) + Task 5 (state wiring) |
| Step switching changes content | Task 5 (PLACEHOLDERS map) |
| TopBar with title + version | Task 2 |
| StatusBar with status dot | Task 2 |
| 4 placeholder cards | Task 4 |
| Dark theme (gray-950/900/800) | Task 3 (sidebar), Task 2 (top/status bars), Task 4 (cards) |
| Tailwind CSS | Task 1 (config), all components |
| Monorepo (workspaces) | Task 1 (root package.json + dashboard/) |
| Vite + React + TypeScript | Task 1 (scaffolding) |
| Desktop-first | All components (h-screen, w-64, etc.) |

**2. Placeholder scan:** No TBD, TODO, or vague references. All code concrete.

**3. Type consistency:**
- `StepId` defined in Task 3, consumed by Task 5 via `PLACEHOLDERS` map ✅
- `Status` type inline in Task 5, consumed by StatusBar in Task 2 ✅
- Placeholder components all have same shape (`React.FC` with no props) ✅
