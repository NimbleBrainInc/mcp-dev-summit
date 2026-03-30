"""Report tools for daily briefings and post-conference summaries."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo

from upjack import UpjackApp

ET = ZoneInfo("America/New_York")

CONFERENCE_DAYS = ["2026-04-01", "2026-04-02", "2026-04-03"]

DAY_GREETINGS: dict[str, str] = {
    "2026-04-01": "Pre-conference workshops",
    "2026-04-02": "Day 1 of the main conference",
    "2026-04-03": "Day 2 — final day",
}


def _previous_day(day: str) -> str | None:
    """Return the previous conference day, or None if there isn't one."""
    try:
        idx = CONFERENCE_DAYS.index(day)
    except ValueError:
        return None
    if idx == 0:
        return None
    return CONFERENCE_DAYS[idx - 1]


def _resolve_default_day(day: str) -> str:
    """Resolve the default day: today if during conference, else Apr 2."""
    if day:
        return day
    today = datetime.now(ET).strftime("%Y-%m-%d")
    if today in CONFERENCE_DAYS:
        return today
    return "2026-04-02"


def _get_bookmark_session_id(bookmark: dict) -> str | None:
    """Extract the session ID from a bookmark's relationships."""
    for rel in bookmark.get("relationships", []):
        if rel.get("rel") == "bookmarks":
            return rel["target"]
    return None


def _get_note_session_id(note: dict) -> str | None:
    """Extract the session ID from a note's relationships."""
    for rel in note.get("relationships", []):
        if rel.get("rel") == "about_session":
            return rel["target"]
    return None


def daily_briefing(app: UpjackApp, day: str = "") -> dict:
    """Generate a morning briefing for a conference day.

    Pulls together bookmarked sessions, yesterday's action items,
    follow-up reminders, and evening events into one view.
    """
    day = _resolve_default_day(day)

    # --- Get all data ---
    all_bookmarks = app.list_entities("bookmark")
    all_sessions = app.list_entities("session", limit=500)
    all_notes = app.list_entities("note")
    all_connections = app.list_entities("connection")

    session_map = {s["id"]: s for s in all_sessions}
    day_sessions = [s for s in all_sessions if s.get("day") == day]

    # --- Today's bookmarked sessions ---
    todays_sessions = []
    bookmark_pairs: list[tuple[dict, dict]] = []
    for bookmark in all_bookmarks:
        session_id = _get_bookmark_session_id(bookmark)
        if not session_id:
            continue
        session = session_map.get(session_id)
        if not session or session.get("day") != day:
            continue
        bookmark_pairs.append((bookmark, session))
        todays_sessions.append(
            {
                "time": f"{session['start_time']}-{session['end_time']}",
                "title": session.get("title", ""),
                "room": session.get("room"),
                "priority": bookmark.get("priority"),
            }
        )

    # --- Schedule summary ---
    if not todays_sessions:
        schedule_summary = "No sessions bookmarked yet."
    else:
        sessions_for_day = [s for _, s in bookmark_pairs]
        type_counts: Counter[str] = Counter()
        time_ranges: dict[str, list[str]] = {}
        for session in sessions_for_day:
            stype = session.get("session_type", "unknown")
            type_counts[stype] += 1
            time_ranges.setdefault(stype, []).append(session.get("start_time", ""))

        parts = []
        for stype, _count in type_counts.most_common():
            times = sorted(time_ranges[stype])
            label_text = stype.replace("_", " ").capitalize()
            if len(times) >= 2:
                parts.append(f"{label_text}s {times[0]}-{times[-1]}")
            else:
                parts.append(f"{label_text} at {times[0]}")
        schedule_summary = ", then ".join(parts) if parts else ""

    # --- Action items from yesterday ---
    action_items_from_yesterday: list[str] = []
    prev_day = _previous_day(day)
    if prev_day:
        for note in all_notes:
            session_id = _get_note_session_id(note)
            if session_id:
                session = session_map.get(session_id)
                if session and session.get("day") == prev_day:
                    action_items_from_yesterday.extend(note.get("action_items", []))
            elif note.get("created_at", "").startswith(prev_day):
                action_items_from_yesterday.extend(note.get("action_items", []))

    # --- Follow-ups due today or earlier ---
    follow_ups_due = []
    for conn in all_connections:
        if conn.get("follow_up_by") and conn["follow_up_by"] <= day:
            follow_ups_due.append(
                {
                    "name": conn.get("name", ""),
                    "company": conn.get("company", ""),
                    "follow_up": conn.get("follow_up", ""),
                }
            )

    # --- Today's highlights (notable sessions from full schedule) ---
    todays_highlights = []
    for session in day_sessions:
        if session.get("session_type") == "keynote":
            speaker_names = ", ".join(session.get("speaker_names") or [])
            highlight = f"Keynote: {session.get('title', '')}"
            if speaker_names:
                highlight += f" ({speaker_names})"
            todays_highlights.append(highlight)

    # --- Evening event ---
    evening_event = None
    for session in day_sessions:
        if session.get("session_type") == "social":
            evening_event = {
                "name": session.get("title", ""),
                "venue": session.get("room"),
                "time": f"{session['start_time']}-{session['end_time']}",
                "details": session.get("description"),
            }
            break

    # --- Greeting ---
    greeting_label = DAY_GREETINGS.get(day, day)
    session_count = len(todays_sessions)
    if session_count > 0:
        greeting = f"{greeting_label}. {session_count} session{'s' if session_count != 1 else ''} bookmarked."
    else:
        greeting = f"{greeting_label}. No sessions bookmarked yet."

    return {
        "day": day,
        "greeting": greeting,
        "schedule_summary": schedule_summary,
        "todays_sessions": todays_sessions,
        "action_items_from_yesterday": action_items_from_yesterday,
        "follow_ups_due": follow_ups_due,
        "todays_highlights": todays_highlights,
        "evening_event": evening_event,
    }


def post_conference_report(app: UpjackApp, format: str = "summary") -> dict:
    """Generate a post-conference report in the requested format.

    Formats:
        summary: Top insights, action items, connections, stats (compact).
        detailed: All notes organized by theme, full takeaways.
        team_share: 3 short paragraphs for a team Slack post.
    """
    # --- Load all personal data ---
    all_bookmarks = app.list_entities("bookmark")
    all_notes = app.list_entities("note")
    all_connections = app.list_entities("connection")
    all_sessions = app.list_entities("session", limit=500)

    session_map = {s["id"]: s for s in all_sessions}

    # --- Stats ---
    sessions_with_notes: set[str] = set()
    for note in all_notes:
        sid = _get_note_session_id(note)
        if sid:
            sessions_with_notes.add(sid)

    stats = {
        "sessions_attended": len(sessions_with_notes),
        "notes_captured": len(all_notes),
        "connections_made": len(all_connections),
    }

    # --- Extract takeaways and action items from all notes ---
    key_insights: list[str] = []
    action_items: list[dict] = []

    for note in all_notes:
        key_insights.extend(note.get("key_takeaways", []))

        source = note.get("title") or ""
        if not source:
            sid = _get_note_session_id(note)
            if sid:
                session = session_map.get(sid)
                if session:
                    source = session.get("title", "")

        for item in note.get("action_items", []):
            action_items.append(
                {
                    "item": item,
                    "source": source,
                    "urgency": "normal",
                }
            )

    # --- Group notes by track/topic to find themes ---
    track_notes: dict[str, list[dict]] = {}
    for note in all_notes:
        track_label = "General"
        sid = _get_note_session_id(note)
        if sid:
            session = session_map.get(sid)
            if session and session.get("track"):
                track_label = session["track"].replace("_", " ").title()

        track_notes.setdefault(track_label, []).append(
            {
                "title": note.get("title"),
                "session_id": sid,
                "takeaways": note.get("key_takeaways", []),
                "content": note.get("content", ""),
            }
        )

    themes = []
    for theme, notes_in_theme in track_notes.items():
        all_takeaways = []
        for n in notes_in_theme:
            all_takeaways.extend(n.get("takeaways", []))

        summary = (
            "; ".join(all_takeaways[:3])
            if all_takeaways
            else "Notes captured, no specific takeaways recorded."
        )

        themes.append(
            {
                "theme": theme,
                "session_count": len(notes_in_theme),
                "summary": summary,
            }
        )

    themes.sort(key=lambda t: t["session_count"], reverse=True)

    # --- Connections by warmth ---
    connections_to_follow_up = []
    for conn in all_connections:
        if conn.get("follow_up"):
            connections_to_follow_up.append(
                {
                    "name": conn.get("name", ""),
                    "company": conn.get("company", ""),
                    "follow_up": conn.get("follow_up", ""),
                    "warmth": conn.get("warmth"),
                }
            )

    # Sort: hot first, then warm, then cool
    warmth_order = {"hot": 0, "warm": 1, "cool": 2}
    connections_to_follow_up.sort(key=lambda c: warmth_order.get(c.get("warmth") or "cool", 99))

    # --- Missed sessions: bookmarked but no notes ---
    bookmarked_session_ids: set[str] = set()
    for b in all_bookmarks:
        sid = _get_bookmark_session_id(b)
        if sid:
            bookmarked_session_ids.add(sid)

    missed_sessions = []
    for session_id in bookmarked_session_ids:
        if session_id not in sessions_with_notes:
            session = session_map.get(session_id)
            if session:
                missed_sessions.append(
                    {
                        "title": session.get("title", ""),
                        "reason": "Bookmarked but no notes taken",
                    }
                )

    # --- Handle empty data ---
    if not all_notes and not all_bookmarks and not all_connections:
        key_insights = [
            "No conference data recorded yet. Add bookmarks, notes, and connections to generate a report."
        ]

    # --- Build base result ---
    result: dict = {
        "format": format,
        "conference": "MCP Dev Summit North America 2026",
        "dates": "April 1-3, 2026",
        "stats": stats,
        "key_insights": key_insights,
        "action_items": action_items,
        "connections_to_follow_up": connections_to_follow_up,
        "themes": themes,
        "missed_sessions": missed_sessions,
    }

    # --- Format-specific adjustments ---
    if format == "team_share":
        # Build 3 short paragraphs for a Slack post
        paragraphs = []

        # Paragraph 1: Overview
        if stats["sessions_attended"] > 0:
            paragraphs.append(
                f"Just wrapped up the MCP Dev Summit (Apr 1-3). "
                f"Attended {stats['sessions_attended']} sessions and "
                f"made {stats['connections_made']} connections."
            )
        else:
            paragraphs.append("Just wrapped up the MCP Dev Summit (Apr 1-3).")

        # Paragraph 2: Key insights
        if key_insights:
            top = key_insights[:3]
            paragraphs.append("Key takeaways: " + ". ".join(top) + ".")
        else:
            paragraphs.append("Detailed notes to follow.")

        # Paragraph 3: Action items
        if action_items:
            items_text = ", ".join(a["item"] for a in action_items[:3])
            paragraphs.append(f"Next steps: {items_text}.")
        else:
            paragraphs.append("Will share detailed learnings in our next sync.")

        result["team_share_text"] = "\n\n".join(paragraphs)

    elif format == "detailed":
        # Add full organized notes by theme
        detailed_themes = []
        for theme, notes_in_theme in track_notes.items():
            theme_detail: dict = {
                "theme": theme,
                "sessions": [],
            }
            for n in notes_in_theme:
                session_title = n.get("title") or ""
                if not session_title and n.get("session_id"):
                    session = session_map.get(n["session_id"])
                    if session:
                        session_title = session.get("title", "")

                theme_detail["sessions"].append(
                    {
                        "title": session_title,
                        "content": n.get("content", ""),
                        "takeaways": n.get("takeaways", []),
                    }
                )
            detailed_themes.append(theme_detail)

        result["detailed_themes"] = detailed_themes

    return result
