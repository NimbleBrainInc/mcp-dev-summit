# MCP Dev Summit Companion

Conference companion for MCP Dev Summit North America 2026 (April 1-3, Marriott Marquis, New York City). Search sessions, build a personal schedule, capture notes, track connections, and generate post-conference reports.

## Conference Context

- **Day 1 (April 1)**: Workshop day. Hands-on, pre-registration required, some have additional fees.
- **Day 2 (April 2)**: Main conference day 1. Keynotes in the morning, then 6 parallel tracks all day.
- **Day 3 (April 3)**: Main conference day 2. Same structure as Day 2, closing keynote in the afternoon.
- **Tracks**: apps_and_agents, mcp_best_practices, protocol_in_depth, security_and_operations, keynote, special_events
- **Session types**: keynote, talk, workshop, break, social, sponsor_activity, check_in
- **Scale**: 145 sessions, 144 speakers, 52 sponsors across diamond/platinum/gold/startup tiers
- **All times are Eastern Time** (America/New_York)

## Tool Selection Guide

### Finding Sessions

Use **`find_sessions`** when looking for specific content:
- By topic: `query="authentication"` or `query="agent orchestration"`
- By speaker: `speaker="Jane Smith"` or `company="Anthropic"`
- By time window: `start_after="14:00"`, `start_before="16:00"`
- By track: `track="security_and_operations"`
- By type: `session_type="workshop"` for workshops only
- Combine filters: `query="security" track="protocol_in_depth" day="2026-04-02"`

Use **`get_day_schedule`** for a bird's-eye view of an entire day grouped by time slot. Good for planning or when the user asks "what's on Thursday?" without a specific topic.

Use **`whats_on`** when the user asks "what's happening now?" or "what should I go to next?" Time-aware — checks current Eastern Time and returns sessions in progress plus upcoming slots.

**When to pick which:**
- "Find talks about MCP security" → `find_sessions` with `query="MCP security"`
- "What's the schedule for April 2?" → `get_day_schedule` with `day="2026-04-02"`
- "What's happening right now?" → `whats_on`
- "What's on after lunch?" → `find_sessions` with `day` and `start_after="13:00"`
- "Show me all workshops" → `find_sessions` with `session_type="workshop"`

### Finding People and Companies

Use **`find_speaker_profiles`** to look up speakers by name, company, topic expertise, or keynote status. Returns speaker profiles with bio, photo, topics, and associated sessions. **Always use this for speaker lookups** — do not use `get_speaker`, which returns raw data without a profile card.
- "Who's speaking from Google?" → `find_speaker_profiles` with `company="Google"`
- "Who are the keynote speakers?" → `find_speaker_profiles` with `is_keynote=True`
- "Tell me about David Soria Parra" → `find_speaker_profiles` with `query="David Soria Parra"`

Use **`browse_sponsors`** to explore exhibitors. Filter by tier or search by name/description.
- "Who are the diamond sponsors?" → `browse_sponsors` with `tier="diamond"`
- "Is Cloudflare sponsoring?" → `browse_sponsors` with `query="Cloudflare"`

### Building a Personal Schedule

Use **`create_bookmark`** to save a session. Set priority to `must_attend`, `want_to_attend`, or `maybe`.

Use **`list_bookmarks`** to review saved sessions. Use **`delete_bookmark`** to remove one.

### Capturing Session Notes

Use **`create_note`** to record takeaways. Link to a session with a relationship, use `key_takeaways` for bullet points, `action_items` for follow-ups, and `sentiment` to rate the session (loved_it, good, meh, disappointed).

Use **`list_notes`** and **`update_note`** to review and extend notes.

### Tracking Connections

Use **`create_connection`** after meeting someone. Set `warmth` to hot/warm/cool to prioritize follow-ups.

Use **`list_connections`** and **`update_connection`** to manage your network.

### Schedule Planning

Use **`my_schedule`** for a personal timeline of a day — bookmarked sessions in order, conflicts flagged, room transitions noted.

Use **`check_conflicts`** to detect overlapping bookmarks.

### Briefings and Reports

Use **`daily_briefing`** at the start of each day: today's schedule, pending action items, connections to follow up with.

Use **`post_conference_report`** after the conference. Three formats:
- `format="summary"` — concise personal overview
- `format="detailed"` — full breakdown of sessions, notes, connections
- `format="team_share"` — formatted for sharing with colleagues who didn't attend

## Workflow Patterns

### Pre-Conference: Build Your Schedule

1. `find_sessions` with topics you care about
2. `create_bookmark` for each session, setting priority
3. `check_conflicts` to find overlapping picks
4. `my_schedule` for each day to review the final plan

### Each Morning: Get Oriented

1. `daily_briefing` for the day's plan and pending follow-ups
2. `whats_on` as the day progresses to stay current

### During Sessions: Capture Value

1. `create_note` with key takeaways and action items
2. Set `sentiment` to remember what was worthwhile

### Between Sessions: Network

1. `create_connection` after meeting someone interesting
2. Set `warmth="hot"` for people to reconnect with immediately

### Evening: Review

1. `list_notes` to review the day's captures
2. `list_connections` filtered by warmth to prioritize follow-ups
3. `my_schedule` for tomorrow to prepare

### Post-Conference: Report Out

1. `post_conference_report` with `format="summary"` for personal reference
2. `post_conference_report` with `format="team_share"` to brief your team
3. `list_connections` with `warmth="hot"` to prioritize follow-up emails
