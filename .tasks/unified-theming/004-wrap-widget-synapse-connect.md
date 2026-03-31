# Task 004: _wrap_widget — Replace Hand-Rolled Handshake with connect() IIFE

**Status**: pending
**Parallel Group**: B
**Depends On**: none
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/src/mcp_dev_summit/server.py` (modify `_wrap_widget` at line ~407)

## Description

Replace the hand-rolled handshake JS in `_wrap_widget` with the Synapse connect() IIFE. This function generates the HTML wrapper for session-widget and schedule-widget. Currently it uses a broken `onload` handshake. Switch to the same pattern as the speaker widget: concatenate the Synapse IIFE + a small `Synapse.connect()` call.

Since `_wrap_widget` produces server-side rendered HTML (the data is already in the body), it doesn't need `on("tool-result")`. It just needs the handshake + resize.

## Implementation

Change `_wrap_widget` from:
```python
def _wrap_widget(body_html: str, widget_name: str = "widget") -> str:
    handshake_js = "window.parent.postMessage(...)..."  # broken hand-rolled JS
    return f'<body onload="{handshake_js}">{body_html}</body>'
```

To:
```python
def _wrap_widget(body_html: str, widget_name: str = "widget") -> str:
    synapse_js = _SYNAPSE_IIFE_PATH.read_text()
    widget_js = f"Synapse.connect({{name:'{widget_name}',version:'1.0.0',autoResize:true}});"
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<style>{_WIDGET_CSS}</style></head>"
        f"<body>{body_html}"
        f"<script>{synapse_js}</script>"
        f"<script>{widget_js}</script>"
        "</body></html>"
    )
```

Key: use `autoResize: true` since the content is already rendered. `connect()` handles handshake + resize automatically.

## Acceptance Criteria

- [ ] `_wrap_widget` uses Synapse.connect() IIFE, not hand-rolled postMessage
- [ ] Session widget and schedule widget both work (they use `_wrap_widget`)
- [ ] Handshake is spec-compliant (verified by Synapse.connect())
- [ ] Initial size is sent before handshake (Synapse.connect() does this)
- [ ] No `onload` attribute in the body tag
- [ ] `make check` passes

## Tests Required

- Session widget HTML contains `Synapse.connect(`
- Schedule widget HTML contains `Synapse.connect(`
- Neither contains hand-rolled `ui/initialize` postMessage

## Verification

```bash
cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit
make check
# Verify no hand-rolled protocol in _wrap_widget output
python3 -c "
import mcp_dev_summit.server as srv
html = srv._wrap_widget('<p>test</p>', 'test-widget')
assert 'Synapse.connect(' in html, 'Missing Synapse.connect'
assert 'onload' not in html, 'Still has onload handshake'
print('PASS')
"
```
