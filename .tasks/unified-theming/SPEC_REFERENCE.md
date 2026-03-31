# Unified Theming Architecture — Spec Reference

## North Star

One theming path. `Synapse.connect()` injects host CSS variables into the DOM. Everything uses `var(--token, fallback)`. No inline JS styles for colors. No per-widget protocol code.

## Token Contract (Dark Fallbacks)

| Token | Purpose | Fallback |
|---|---|---|
| `--color-text-primary` | Main text | `#e2e8f0` |
| `--color-text-secondary` | Supporting text | `#94a3b8` |
| `--color-text-tertiary` | Muted text | `#64748b` |
| `--color-text-accent` | Links, highlights | `#818cf8` |
| `--color-background-primary` | Page background | `#0f172a` |
| `--color-background-secondary` | Card background | `#1e293b` |
| `--color-background-tertiary` | Tags, inputs | `#1e293b` |
| `--color-border-primary` | Borders, dividers | `#334155` |
| `--font-weight-semibold` | Headings | `600` |
| `--font-text-xs-size` | Small text | `12px` |
| `--font-text-sm-size` | Body text | `13px` |
| `--border-radius-xs` | Tag/badge radius | `4px` |
| `--border-radius-sm` | Card radius | `0.5rem` |
| `--border-radius-md` | Large card radius | `8px` |
| `--border-width-regular` | Border width | `1px` |
| `--font-sans` | Font family | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--nb-color-accent-foreground` | Text on accent bg | `#ffffff` |

## Three Workstreams

### 1. Synapse SDK (`/Users/mgolds02/Code/hq/packages/synapse`)
- `connect()` in `src/connect.ts`: inject `hostContext.styles.variables` into `document.documentElement.style` after init response
- Same injection on `theme-changed` events
- React `AppProvider` in `src/react/app-provider.tsx`: inject CSS vars via `useEffect` when theme changes

### 2. mcp-dev-summit widgets (`server.py`)
- `_WIDGET_CSS` (line ~371): add fallbacks to ALL `var()` calls
- `_wrap_widget` (line ~407): replace hand-rolled handshake with Synapse.connect() IIFE
- Session widget (line ~660): uses `_wrap_widget` — gets fixed automatically
- Schedule widget (line ~723): uses `_wrap_widget` — gets fixed automatically
- Speaker-card widget (line ~293): add Synapse.connect() IIFE + CSS var fallbacks
- Speaker widget (line ~164): already done ✓
- Add `.link:visited,.link:active` rules everywhere `.link` is styled

### 3. App.tsx (`ui/src/App.tsx`)
- Replace inline `style={{}}` objects with CSS classes using `var(--token, fallback)`
- Move the `s` style object into a `<style>` block or CSS file
- Keep `useTheme()` for mode detection only (className switching), not for individual colors
- Same visual design, just CSS vars instead of JS inline styles

## Verification
- `make check` passes (18 tests)
- `cd ui && npm run build` succeeds
- `cd ui && npm run dev` → `http://localhost:5173/__preview` works
- All widgets readable in both dark and light themes
- No hardcoded colors except as `var()` fallbacks
