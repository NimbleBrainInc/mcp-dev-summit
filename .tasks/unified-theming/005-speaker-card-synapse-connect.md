# Task 005: Speaker-Card Widget — Add connect() IIFE + CSS Var Fallbacks

**Status**: pending
**Parallel Group**: B
**Depends On**: none
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/src/mcp_dev_summit/server.py` (modify `speaker_card_ui` at line ~293)

## Description

The `speaker/{speaker_id}` resource serves a static speaker profile card. It currently has:
- No Synapse.connect() — uses raw postMessage for link handling
- Hand-rolled handshake (broken: sends initialize and initialized immediately without waiting)
- CSS vars WITHOUT fallbacks

Migrate to: Synapse.connect() IIFE + CSS var fallbacks + proper link handling via `app.openLink()`.

## Implementation

The speaker-card is server-side rendered (data is fetched from Upjack and baked into the HTML). It doesn't need `on("tool-result")`. It needs:
1. `Synapse.connect()` for handshake + resize + theming
2. `app.openLink()` for LinkedIn links (replacing raw postMessage)
3. CSS var fallbacks on all tokens

Replace the current f-string HTML with:
- Inline the Synapse IIFE via `_SYNAPSE_IIFE_PATH.read_text()`
- Small `<script>` that calls `Synapse.connect({name:'speaker-card', version:'1.0.0', autoResize:true})` and stores `app` for `openLink()`
- Add fallbacks to all `var()` in the inline CSS
- Add `.link:visited,.link:active` rule
- Replace `onclick="window.parent.postMessage(...)"` on LinkedIn link with `onclick="app.openLink('...')"` (using a global `app` variable set by connect)

## Acceptance Criteria

- [ ] Speaker card uses Synapse.connect() IIFE
- [ ] All CSS `var()` calls have dark fallbacks
- [ ] `.link:visited,.link:active` has accent color
- [ ] LinkedIn link uses `app.openLink()` not raw postMessage
- [ ] Handshake is spec-compliant
- [ ] `make check` passes

## Tests Required

- Speaker card HTML contains `Synapse.connect(`
- Speaker card HTML does NOT contain hand-rolled `ui/initialize` postMessage
- All `var()` have fallbacks (grep test)

## Verification

```bash
cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit
make check
```
