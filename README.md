# MCP Dev Summit Companion

[![CI](https://github.com/NimbleBrainInc/mcp-dev-summit/actions/workflows/ci.yml/badge.svg)](https://github.com/NimbleBrainInc/mcp-dev-summit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![mpak](https://img.shields.io/badge/mpak-%40nimblebraininc%2Fmcp--dev--summit-5B4FE8)](https://mpak.dev/bundles/@nimblebraininc/mcp-dev-summit)

An MCP server for [MCP Dev Summit North America 2026](https://mcpdevsummitna.sched.com/). Ask your AI assistant natural language questions about the full conference program — 145 sessions, 144 speakers, 52 sponsors — and manage a personal schedule, session notes, and connections.

```
"What talks on Thursday cover agent orchestration?"
"Tell me about the keynote speakers from Anthropic."
"What's happening right now?"
"Build me a schedule that doesn't conflict."
```

## Install

**Via [mpak](https://mpak.dev)** (recommended):

```bash
mpak bundle pull @nimblebraininc/mcp-dev-summit
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-dev-summit": {
      "command": "python",
      "args": ["-m", "mcp_dev_summit.server"]
    }
  }
}
```

**Manual** (Python 3.13+, requires [uv](https://docs.astral.sh/uv/)):

```bash
git clone https://github.com/NimbleBrainInc/mcp-dev-summit
cd mcp-dev-summit
uv sync
python -m mcp_dev_summit.server
```

## Tools

### Conference data

| Tool | Description |
|------|-------------|
| `find_sessions` | Search sessions by topic, speaker, track, day, or time range |
| `get_day_schedule` | Full schedule for a day, grouped by time slot |
| `whats_on` | What's happening now or up next (Eastern Time) |
| `find_speaker_profiles` | Speaker search with bio, topics, and session list |
| `browse_sponsors` | Sponsor directory by tier with booth activities |

### Personal schedule (local)

| Tool | Description |
|------|-------------|
| `create_bookmark` / `list_bookmarks` / `delete_bookmark` | Save sessions to your schedule |
| `create_note` / `list_notes` / `update_note` | Capture session takeaways |
| `create_connection` / `list_connections` | Track people you meet |
| `my_schedule` | Your personal timeline with conflict detection |
| `check_conflicts` | Find overlapping bookmarked sessions |
| `daily_briefing` | Morning summary: today's sessions, action items, follow-ups |
| `post_conference_report` | Post-event summary with key takeaways |

## Data model

6 entities with JSON schemas in `schemas/`:

| Entity | Kind | Description |
|--------|------|-------------|
| `session` | Reference | All sessions, keynotes, and workshops |
| `speaker` | Reference | Speaker profiles with bios and photos |
| `sponsor` | Reference | Sponsors by tier |
| `bookmark` | Personal | Your saved sessions |
| `note` | Personal | Session notes |
| `connection` | Personal | People you met |

Reference data seeds automatically on first run from `seed/`. Personal data is stored locally in `workspace/` and never leaves your machine.

## Development

Requires Python 3.13+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync --group dev
make run          # stdio mode
make run-http     # HTTP mode (port 8000)
make test         # run tests
make check        # format + lint + typecheck + test
```

## License

MIT
