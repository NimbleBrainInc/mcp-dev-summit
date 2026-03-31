# Task 007: Build, Link, and Verify All Surfaces

**Status**: pending
**Parallel Group**: C
**Depends On**: 001, 002, 003, 004, 005, 006
**Files to Create/Modify**:
- No new files — integration verification

## Description

Build Synapse SDK, link it into mcp-dev-summit, rebuild the UI, run all tests, and verify every surface works in both themes.

## Steps

1. Build Synapse: `cd /Users/mgolds02/Code/hq/packages/synapse && npm run build`
2. Link: `npm link && cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/ui && npm link @nimblebrain/synapse`
3. Build UI: `npm run build`
4. Run Python checks: `cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit && make check`
5. Start preview: `cd ui && npm run dev`
6. Verify at `http://localhost:5173/__preview`:
   - Sidebar app: dark theme readable, light theme readable
   - Speaker search: results render with photos
   - Schedule view: times, rooms, tracks visible
   - Bookmarks view: cards visible
   - All links: accent color in all states (hover, visited, active)

## Acceptance Criteria

- [ ] `npm run build` (Synapse) succeeds
- [ ] `npm run build` (UI) succeeds
- [ ] `make check` passes (18 tests)
- [ ] Preview renders correctly
- [ ] No `var()` without fallbacks (grep verification)
- [ ] No hand-rolled postMessage handshakes remain (only in Synapse.connect IIFE)
- [ ] Speaker widget, session widget, schedule widget, speaker-card all use Synapse.connect()

## Verification

```bash
# Full verification script
cd /Users/mgolds02/Code/hq/packages/synapse && npm run build && npm link

cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit/ui && npm link @nimblebrain/synapse && npm run build

cd /Users/mgolds02/Code/hq/mcp-servers/mcp-dev-summit && make check

# Verify no bare var() in server.py
python3 -c "
import re
content = open('src/mcp_dev_summit/server.py').read()
bare = re.findall(r'var\(--[^,)]+\)', content)
print(f'Bare var(): {len(bare)}')
for v in bare[:5]: print(f'  {v}')
"

# Verify Synapse.connect used everywhere
python3 -c "
import mcp_dev_summit.server as srv
for name in ['speaker_widget_ui', 'session_widget_ui', 'schedule_widget_ui', 'speaker_card_ui']:
    fn = getattr(srv, name, None)
    if fn:
        html = fn() if 'speaker_card' not in name else 'skip'
        if html != 'skip':
            assert 'Synapse.connect(' in html, f'{name} missing Synapse.connect'
            print(f'{name}: OK')
print('_wrap_widget:', 'OK' if 'Synapse.connect(' in srv._wrap_widget('<p>t</p>') else 'FAIL')
"
```
