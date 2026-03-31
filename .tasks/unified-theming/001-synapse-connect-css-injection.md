# Task 001: Synapse SDK — CSS Variable Injection in connect()

**Status**: pending
**Parallel Group**: A
**Depends On**: none
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/packages/synapse/src/connect.ts` (modify)

## Description

After `connect()` receives the `hostContext` in the init response, inject all CSS variables from `hostContext.styles.variables` into `document.documentElement.style`. Do the same when a `theme-changed` event arrives. This makes host theming automatic for every widget that uses `connect()`.

## Implementation

In `connect.ts`, after extracting theme from `hostContext` (around where `currentTheme` is set):

```typescript
// Inject host CSS variables into the DOM
function injectCssVariables(vars: Record<string, string> | undefined | null): void {
  if (!vars || typeof vars !== "object") return;
  for (const [k, v] of Object.entries(vars)) {
    if (typeof k === "string" && typeof v === "string") {
      document.documentElement.style.setProperty(k, v);
    }
  }
}

// After init response:
const styles = safeObj(hostContext?.styles);
injectCssVariables(styles?.variables as Record<string, string> | undefined);

// In the theme-changed handler:
// After updating currentTheme, also re-inject CSS variables
injectCssVariables(currentTheme.tokens);
```

Also inject from `params.tokens` on `theme-changed` events (the handler already receives `params.tokens`).

## Acceptance Criteria

- [ ] After `connect()` resolves, `document.documentElement.style` has CSS properties from `hostContext.styles.variables`
- [ ] When `theme-changed` fires, CSS properties are updated
- [ ] If host sends no variables, nothing breaks (graceful no-op)
- [ ] If `styles.variables` contains non-string values, they're skipped
- [ ] Existing `connect()` behavior unchanged (theme JS object, events, resize, etc.)

## Tests Required

- `connect()` with mock host that sends `styles.variables` → verify `document.documentElement.style` has the values
- `connect()` with mock host that sends NO variables → verify no errors
- Theme-changed event → verify CSS properties update

## Verification

```bash
cd /Users/mgolds02/Code/hq/packages/synapse
npm run build
# Verify connect.iife.global.js contains setProperty
grep "setProperty" dist/connect.iife.global.js
```
