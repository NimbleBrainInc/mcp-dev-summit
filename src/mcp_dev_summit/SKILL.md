# MCP Dev Summit Companion

Conference companion for MCP Dev Summit North America 2026 (April 1-3, Marriott Marquis, New York City). Search sessions, build a personal schedule, capture notes, track connections, and generate post-conference reports.

## Deployment Modes

This server runs in two modes that determine which tools are available:

**Hosted mode** (5 tools) — Read-only access to the conference program via a public HTTP endpoint. Anyone can connect with zero auth. Tools: `search_sessions`, `get_day_schedule`, `whats_on`, `find_speakers`, `browse_sponsors`.

**Local mode** (18 tools) — Full companion experience installed via `mpak install mcp-dev-summit`. Includes everything from hosted mode plus personal data management (bookmarks, notes, connections), schedule planning, conflict detection, daily briefings, and post-conference reports. Data stays local on disk.

If a tool call fails because it is not available, the user is likely connected to the hosted endpoint. Suggest installing locally with `mpak install mcp-dev-summit` for full functionality.

## Conference Context

- **Day 1 (April 1)**: Workshop day. Hands-on, pre-registration required, some have additional fees. Fewer parallel sessions.
- **Day 2 (April 2)**: Main conference day 1. Keynotes in the morning, then 6 parallel tracks all day.
- **Day 3 (April 3)**: Main conference day 2. Same structure as Day 2, closing keynote in the afternoon.
- **Tracks** (main conference days): apps_and_agents, mcp_best_practices, protocol_in_depth, security_and_operations, keynote, special_events
- **Session types**: keynote, talk, workshop, break, social, sponsor_activity, check_in
- **Scale**: ~120 sessions, ~100 speakers, ~50 sponsors across diamond/platinum/gold/startup tiers, 500+ attendees
- **All times are Eastern Time** (America/New_York)

## Tool Selection Guide

### Finding Sessions

Use **`search_sessions`** when looking for specific content:
- By topic: `query="authentication"` or `query="agent orchestration"`
- By speaker: `speaker="Jane Smith"` or `company="Anthropic"`
- By time window: `start_after="14:00"`, `start_before="16:00"`
- By track: `track="security_and_operations"`
- By type: `session_type="workshop"` for workshops only
- Combine filters: `query="security" track="protocol_in_depth" day="2026-04-02"`

Use **`get_day_schedule`** for a bird's-eye view of an entire day grouped by time slot. Good for planning or when the user asks "what's on Tuesday?" without a specific topic. Optionally filter to a single track.

Use **`whats_on`** when the user asks "what's happening now?" or "what should I go to next?" This tool is time-aware — it checks the current time in Eastern Time and returns sessions currently in progress plus the next upcoming time slots. Use `include_next` to control how far ahead to look. Only useful during the actual conference dates.

**When to pick which:**
- "Find talks about MCP security" -> `search_sessions` with `query="MCP security"`
- "What's the schedule for April 2?" -> `get_day_schedule` with `day="2026-04-02"`
- "What's happening right now?" -> `whats_on`
- "What's on after lunch?" -> `search_sessions` with `day` and `start_after="13:00"`
- "Show me all workshops" -> `search_sessions` with `session_type="workshop"`

### Finding People and Companies

Use **`find_speakers`** to look up speakers by name, company, topic expertise, or keynote status. Returns speaker profiles with their associated sessions.
- "Who's speaking from Google?" -> `find_speakers` with `company="Google"`
- "Who are the keynote speakers?" -> `find_speakers` with `is_keynote=True`
- "Tell me about David Soria Parra" -> `find_speakers` with `query="David Soria Parra"`

Use **`browse_sponsors`** to explore exhibitors. Filter by tier or search by company name, description, or products. Returns booth activities and sponsored sessions.
- "Who are the diamond sponsors?" -> `browse_sponsors` with `tier="diamond"`
- "Which sponsors are doing demos?" -> `browse_sponsors` then look at `booth_activities`
- "Is Cloudflare sponsoring?" -> `browse_sponsors` with `query="Cloudflare"`

### Building a Personal Schedule (local mode)

Use **`create_bookmark`** to save a session to the personal schedule. Set priority to `must_attend`, `want_to_attend`, or `maybe`. Add notes about why you want to attend. The tool warns if the session conflicts with existing bookmarks.

Use **`list_bookmarks`** to review saved sessions. Filter by day or priority level.

Use **`delete_bookmark`** to remove a session from the schedule.

### Capturing Session Notes (local mode)

Use **`create_note`** to record takeaways during or after a session. Link it to a session with `session_id`, or leave it freeform. Use `key_takeaways` for bullet points and `action_items` for follow-ups. Set `sentiment` to track how valuable the session was (loved_it, good, meh, disappointed).

Use **`list_notes`** to review captured notes. Filter by `session_id` to find notes for a specific session.

Use **`update_note`** to add more takeaways or action items after the fact.

### Tracking Connections (local mode)

Use **`create_connection`** after meeting someone. Capture their name, company, role, contact info, what you talked about, and what to follow up on. Set `warmth` to hot/warm/cool to prioritize follow-ups. Link to a `session_id` if you met at a specific session.

Use **`list_connections`** to review people met. Filter by `warmth` to find priority follow-ups.

Use **`update_connection`** to add follow-up details or change warmth after further interaction.

### Schedule Planning (local mode)

Use **`my_schedule`** for a personal timeline of a conference day. Shows bookmarked sessions in order, flags time conflicts, notes room transitions, and identifies gaps where you could attend other sessions. Defaults to today or the next conference day.

Use **`check_conflicts`** to detect overlapping bookmarks. Check a specific bookmark or scan all bookmarks at once. Returns conflict pairs with overlap duration and resolution suggestions.

### Briefings and Reports (local mode)

Use **`daily_briefing`** at the start of each conference day. Returns today's bookmarked schedule, yesterday's unresolved action items, connections needing follow-up, session highlights, and evening event information.

Use **`post_conference_report`** after the conference ends to generate a comprehensive summary. Three format options:
- `format="summary"` — concise overview of key insights, top action items, and follow-up contacts
- `format="detailed"` — full breakdown of all sessions attended, notes, connections, and themes
- `format="team_share"` — formatted for sharing with colleagues who did not attend, focuses on organizational relevance and actionable takeaways

## Workflow Patterns

### Pre-Conference: Build Your Schedule

1. `search_sessions` with topics you care about
2. `create_bookmark` for each session, setting priority
3. `check_conflicts` to find overlapping picks
4. Resolve conflicts by adjusting bookmarks (`delete_bookmark` + `create_bookmark` alternatives)
5. `my_schedule` for each day to review the final plan

### Each Morning: Get Oriented

1. `daily_briefing` for the day's plan, pending action items, and follow-ups due
2. `whats_on` as the day progresses to stay current

### During Sessions: Capture Value

1. `create_note` with `session_id`, key takeaways, and action items
2. `update_note` to add more as the session continues
3. Rate with `sentiment` to remember what was worthwhile

### Between Sessions: Network

1. `create_connection` after meeting someone interesting
2. Set `follow_up` and `follow_up_by` while the conversation is fresh
3. `warmth="hot"` for people you must reconnect with

### Evening: Review

1. `list_notes` to review the day's captures
2. `list_connections` to review who you met
3. `my_schedule` for tomorrow to prepare

### Post-Conference: Report Out

1. `post_conference_report` with `format="summary"` for personal reference
2. `post_conference_report` with `format="team_share"` to brief your team
3. `list_connections` with `warmth="hot"` to prioritize follow-up emails
