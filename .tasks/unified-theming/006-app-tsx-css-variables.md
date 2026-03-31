# Task 006: App.tsx — Replace Inline Styles with CSS Classes

**Status**: pending
**Parallel Group**: B
**Depends On**: none
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/ui/src/App.tsx` (modify)

## Description

The sidebar React app currently defines all styles as inline JS objects via the `s` variable (19 style definitions, ~40 properties referencing theme tokens). The tokens come from `useTheme()` and are applied as CSS var() strings already — but via `style={{}}` props.

Refactor to use CSS classes with `var(--token, fallback)`. This aligns with the widget approach and makes theming consistent. `Synapse.connect()` (or `SynapseProvider`) injects host CSS variables into `:root`, and both CSS classes and inline styles pick them up.

## Implementation

**Step 1:** Create a `<style>` block at the top of the component (or in a separate CSS string) with all the classes:

```css
.summit-container { background: var(--color-background-primary, #0f172a); color: var(--color-text-primary, #e2e8f0); ... }
.summit-tabs { display: flex; gap: 2px; background: var(--color-background-secondary, #1e293b); ... }
.summit-tab { ... }
.summit-tab--active { background: var(--color-text-accent, #818cf8); color: var(--nb-color-accent-foreground, #ffffff); }
.summit-card { background: var(--color-background-secondary, #1e293b); border: 1px solid var(--color-border-primary, #334155); ... }
/* etc. */
```

**Step 2:** Replace `style={s.container}` with `className="summit-container"`, etc.

**Step 3:** For dynamic styles (like `s.tab(active)`, `s.badge(type)`, `s.dayBtn(active)`), use conditional classNames:
```tsx
<button className={`summit-tab ${tab === "schedule" ? "summit-tab--active" : ""}`}>
```

**Step 4:** Remove the `s` object entirely.

**Step 5:** Remove the theme token variables at the top (`bg`, `fg`, `card`, etc.) — they're no longer needed since CSS vars are used directly in the stylesheet.

**Step 6:** Keep `useTheme()` ONLY if needed for non-CSS logic (e.g., conditional rendering based on mode). If not needed, remove it.

**Important:** The badge colors for session types (keynote=#eab308, talk=#6366f1, etc.) are semantic, not theme-dependent. Keep them as CSS classes with hardcoded colors — they're the same in light and dark.

## Acceptance Criteria

- [ ] No `style={{}}` props that reference theme colors (layout-only inline styles like `display:flex` are OK)
- [ ] All theme colors come from CSS `var(--token, fallback)`
- [ ] The `s` style object is removed
- [ ] Visual design is unchanged (same layout, same colors, same spacing)
- [ ] Dark and light themes both work (fallbacks are dark, host overrides for light)
- [ ] `.link:visited,.link:active` rules exist
- [ ] `npm run build` succeeds
- [ ] App renders correctly in Synapse preview (`npm run dev` → `/__preview`)

## Tests Required

- Visual: preview looks the same before and after
- Build: `npm run build` succeeds with no errors
- Grep: no `style={{.*color` or `style={{.*background` in App.tsx (except badge semantic colors)

## Verification

```bash
cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/ui
npm run build
# Verify no inline theme styles
grep -c 'style={{' src/App.tsx  # Should be minimal (only layout, not colors)
```
