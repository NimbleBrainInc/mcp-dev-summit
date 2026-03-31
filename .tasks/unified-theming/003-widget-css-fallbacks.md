# Task 003: _WIDGET_CSS — Add Fallbacks to All var() Calls

**Status**: pending
**Parallel Group**: B
**Depends On**: none
**Files to Create/Modify**:
- `/Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/src/mcp_dev_summit/server.py` (modify `_WIDGET_CSS` at line ~371 and speaker-card CSS at line ~293)

## Description

Add dark-theme fallback values to every `var()` call in `_WIDGET_CSS` and the speaker-card widget's inline CSS. This ensures widgets are readable even when the host doesn't inject CSS variables.

Also add `.link:visited,.link:active` rules using the accent color token wherever `.link` is styled.

## Token Fallbacks

| Token | Fallback |
|---|---|
| `--color-text-primary` | `#e2e8f0` |
| `--color-text-secondary` | `#94a3b8` |
| `--color-text-tertiary` | `#64748b` |
| `--color-text-accent` | `#818cf8` |
| `--color-background-tertiary` | `#1e293b` |
| `--color-border-primary` | `#334155` |
| `--font-weight-semibold` | `600` |
| `--font-text-xs-size` | `12px` |
| `--font-text-sm-size` | `13px` |
| `--border-radius-xs` | `4px` |
| `--border-radius-md` | `8px` |
| `--border-width-regular` | `1px` |

## Implementation

For `_WIDGET_CSS`: find every `var(--token)` and add the fallback. Example:
- Before: `color:var(--color-text-primary)`
- After: `color:var(--color-text-primary,#e2e8f0)`

Also add `body` base styles:
```css
body{padding:16px;background:transparent;color:var(--color-text-primary,#e2e8f0);
  font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif)}
```

Add link state rules after each `.link` definition:
```css
.link,.link:visited,.link:active{color:var(--color-text-accent,#818cf8);...}
```

For speaker-card CSS (inline f-string around line 293): same treatment — add fallbacks to every `var()`.

## Acceptance Criteria

- [ ] Every `var()` in `_WIDGET_CSS` has a fallback value
- [ ] Every `var()` in speaker-card inline CSS has a fallback value
- [ ] `.link:visited,.link:active` rules exist with accent color
- [ ] `body` has `color` and `font-family` with fallbacks
- [ ] No hardcoded colors except as `var()` fallbacks
- [ ] `make check` passes

## Tests Required

- Visual: widgets render readable text on dark background without host CSS injection
- Grep: `grep 'var(--' server.py | grep -v ','` returns 0 lines (all have fallbacks)

## Verification

```bash
cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit
# Verify every var() has a fallback
python3 -c "
import re
content = open('src/mcp_dev_summit/server.py').read()
bare = re.findall(r'var\(--[^,)]+\)', content)
if bare:
    print(f'FAIL: {len(bare)} var() without fallback:')
    for v in bare[:10]: print(f'  {v}')
else:
    print('PASS: all var() have fallbacks')
"
make check
```
