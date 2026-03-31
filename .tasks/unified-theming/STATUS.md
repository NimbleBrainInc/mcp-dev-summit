# Implementation Status

> **Source**: Unified theming north star architecture
> **Started**: 2026-03-31
> **Status**: Not Started

## Task Summary

| # | Task | Status | Depends On | Parallel Group |
|---|------|--------|------------|----------------|
| 001 | Synapse SDK: CSS variable injection in connect() | pending | — | A |
| 002 | Synapse SDK: CSS variable injection in React AppProvider | pending | 001 | A |
| 003 | _WIDGET_CSS: add fallbacks to all var() calls | pending | — | B |
| 004 | _wrap_widget: replace hand-rolled handshake with connect() IIFE | pending | — | B |
| 005 | Speaker-card widget: add connect() IIFE + CSS var fallbacks | pending | — | B |
| 006 | App.tsx: replace inline styles with CSS classes | pending | — | B |
| 007 | Build, link, and verify all surfaces | pending | 001-006 | C |

## Parallel Groups

- **Group A**: [001, 002] — Synapse SDK changes (must build before consumers can test)
- **Group B**: [003, 004, 005, 006] — Consumer-side changes (independent of each other, can run in parallel)
- **Group C**: [007] — Integration verification (depends on all of A and B)

## Audit Log

| Task | Audit Result | Issues |
|------|-------------|--------|
| — | — | — |
