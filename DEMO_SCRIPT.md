# MCP Dev Summit Companion — Demo Script

**Presenter:** Mat Goldsborough, CEO, NimbleBrain
**Target length:** 3–5 minutes (~400–650 words spoken)
**Format:** Screen recording with voiceover

---

## PART 1 — Claude Code (approx. 2 min)

---

**[ACTION]** Open shot: the MCP Dev Summit schedule page. 145 rows visible, no obvious way to filter.

**MAT:**
MCP Dev Summit is this week. 145 sessions, 144 speakers. If you're trying to figure out who to see and when — it's a lot.

So we built a companion MCP server for it. One install line, and your AI assistant knows the entire conference.

---

**[ACTION]** Open `~/Library/Application Support/Claude/claude_desktop_config.json` in a text editor.

**MAT:**
Here's the config. One entry. That's it.

**[ACTION]** Highlight the relevant block:
```json
"mcp-dev-summit": {
  "command": "mpak",
  "args": ["run", "@nimblebraininc/mcp-dev-summit"]
}
```

**MAT:**
`mpak run @nimblebraininc/mcp-dev-summit` — mpak handles the bundle, the dependencies, everything.

---

**[ACTION]** Switch to Claude Code. Show the MCP connector for `mcp-dev-summit` lighting up green in the toolbar.

**MAT:**
And there it is — connected. Let's actually use it.

---

**[ACTION]** Type into Claude Code:

> "I'm headed to the MCP dev summit — tell me about David Soria Parra"

**[ACTION]** Wait for response. A speaker card renders inline — photo, name, role, company, bio summary.

**MAT:**
Nice. Speaker card renders right inline. David's a Member of Technical Staff at Anthropic — he's the co-creator of MCP. Good person to know about heading into this conference.

---

**[ACTION]** Type:

> "When is David speaking?"

**[ACTION]** Response comes back with session details: Thursday April 2nd, 9:10 AM, Broadway Ballroom. Session card visible inline.

**MAT:**
Thursday morning keynote, Broadway Ballroom. Nine-ten AM. Marked.

---

**[ACTION]** Type:

> "I'm interested in MCP apps. Any talks on Friday?"

**[ACTION]** Response renders a list of sessions — the Friday keynote "MCP Apps: Extending the Frontier" at 9 AM, plus talks like "Lessons Learned Building Intelligent UIs With MCP Apps," "UI in the Age of AI," and others. Each one shows as a session card with time, room, and track.

**MAT:**
Friday is stacked for MCP apps. That keynote at nine is probably the anchor. And you've got a cluster of talks in the afternoon — UI, intelligent interfaces, the full track.

---

**[ACTION]** Pause on the session list for a beat.

**MAT:**
All of this is running locally. No API key, no account. The bundle ships the conference data, and your queries stay on your machine.

Okay — that's Claude Code. But we took it one step further.

---

## PART 2 — NimbleBrain App (approx. 2 min)

---

**[ACTION]** Switch to the NimbleBrain web app. The MCP Dev Summit sidebar item is visible — click it to open.

**MAT:**
This is what we call an MCP App. It's a full web application — sidebar, schedule view, agentic chat — built entirely on the same MCP server you just saw in Claude Code. Same tools, same data. Different surface.

---

**[ACTION]** Click the Speakers tab in the sidebar. Speaker grid loads.

**MAT:**
Speakers tab — everyone at the conference, searchable.

**[ACTION]** Click the Schedule tab. Day-by-day grid loads.

**MAT:**
Full schedule. You can browse by day, filter by track.

---

**[ACTION]** Switch to the agentic chat panel inside the app. Type:

> "Bookmark the MCP Apps keynote on Friday for me"

**[ACTION]** The app responds, confirms the bookmark, and the session appears in a bookmarks list or personal schedule view.

**MAT:**
Chat works the same as Claude Code — it's calling the same MCP tools. Bookmark a session, take a note after a talk, log a connection you made. It all persists locally.

---

**[ACTION]** Hold on the bookmarked session card for a moment.

**MAT:**
This is the pattern we're calling an MCP App. The protocol isn't just a Claude integration layer — it's the full application backend. One server, multiple surfaces.

---

**[ACTION]** Cut to terminal. Type:

```bash
mpak bundle pull @nimblebraininc/mcp-dev-summit
```

**MAT:**
One line to install. The app is at mpak.dev — bundle's open source, MIT license. If you're at the summit, grab it.

See you there.

---

*[END]*

---

## Timing Reference

| Section | Content | Est. Time |
|---------|---------|-----------|
| Hook + config show | Summit size, one-liner install | ~25s |
| Connector lights up | Claude Code connection | ~10s |
| Q1: Who is DSP? | Speaker card renders | ~30s |
| Q2: When is he speaking? | Session card renders | ~20s |
| Q3: Friday MCP apps? | Session list renders | ~35s |
| Local data note + transition | Bridge to Part 2 | ~15s |
| MCP App explainer | What an MCP App is | ~25s |
| Sidebar walkthrough | Speakers + Schedule tabs | ~25s |
| Bookmark in chat | Live tool call from app chat | ~30s |
| Close + install line | mpak install, sign-off | ~25s |
| **Total** | | **~3:40** |
