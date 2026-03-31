# Task 002: Synapse SDK — CSS Variable Injection in React AppProvider

**Status**: pending
**Parallel Group**: A
**Depends On**: 001
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/packages/synapse/src/react/app-provider.tsx` (modify)
- `/Users/mgolds02/Code/hq/packages/synapse/src/react/provider.tsx` (modify)

## Description

The React providers (`AppProvider` for `connect()` API, `SynapseProvider` for `createSynapse()` API) should inject CSS variables into the DOM when the theme changes, so React apps using `useTheme()` get automatic CSS variable injection without manual `style` props.

Since `connect()` now handles injection internally (task 001), `AppProvider` gets this for free. But `SynapseProvider` (which uses `createSynapse()`) needs the same treatment.

## Implementation

In `provider.tsx` (SynapseProvider), add a `useEffect` that injects CSS variables whenever the theme changes:

```typescript
// Inside SynapseProvider or as a child component
function ThemeInjector() {
  const theme = useTheme();
  useEffect(() => {
    if (theme.tokens) {
      for (const [k, v] of Object.entries(theme.tokens)) {
        document.documentElement.style.setProperty(k, v);
      }
    }
  }, [theme]);
  return null;
}
```

Add `<ThemeInjector />` inside the provider's children.

For `AppProvider`: `connect()` already handles injection (task 001). Verify no additional work needed — the React hooks should just reflect the already-injected state.

## Acceptance Criteria

- [ ] `SynapseProvider` injects CSS variables on mount and theme change
- [ ] `AppProvider` — CSS variables already injected by `connect()` (verify, no new code needed)
- [ ] CSS properties update when theme switches (dark → light or vice versa)
- [ ] Build succeeds: `npm run build`

## Tests Required

- Mount `SynapseProvider` with mock host sending tokens → verify `document.documentElement.style` updated
- Theme change event → verify CSS properties re-injected

## Verification

```bash
cd /Users/mgolds02/Code/hq/packages/synapse
npm run build
npm link
```
