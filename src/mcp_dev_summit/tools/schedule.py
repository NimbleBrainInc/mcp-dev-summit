"""Schedule tools for viewing day schedules and time-aware session info."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from upjack import UpjackApp

ET = ZoneInfo("America/New_York")

DAY_LABELS: dict[str, str] = {
    "2026-04-01": "Wednesday — Pre-Conference Workshops",
    "2026-04-02": "Thursday — Main Conference Day 1",
    "2026-04-03": "Friday — Main Conference Day 2",
}

CONFERENCE_DAYS = {"2026-04-01", "2026-04-02", "2026-04-03"}

# Aliases for natural-language day resolution
_DAY_ALIASES: dict[str, str] = {
    "wednesday": "2026-04-01",
    "wed": "2026-04-01",
    "workshops": "2026-04-01",
    "day 0": "2026-04-01",
    "april 1": "2026-04-01",
    "apr 1": "2026-04-01",
    "04-01": "2026-04-01",
    "4/1": "2026-04-01",
    "thursday": "2026-04-02",
    "thu": "2026-04-02",
    "thurs": "2026-04-02",
    "day 1": "2026-04-02",
    "april 2": "2026-04-02",
    "apr 2": "2026-04-02",
    "04-02": "2026-04-02",
    "4/2": "2026-04-02",
    "friday": "2026-04-03",
    "fri": "2026-04-03",
    "day 2": "2026-04-03",
    "april 3": "2026-04-03",
    "apr 3": "2026-04-03",
    "04-03": "2026-04-03",
    "4/3": "2026-04-03",
}


def resolve_day(day: str) -> str:
    """Resolve a natural-language day reference to an ISO date.

    Accepts: ISO dates ("2026-04-02"), day names ("thursday", "fri"),
    partial dates ("april 2", "4/2"), or aliases ("day 1", "workshops").
    Returns the ISO date string, or the original input if unrecognized.
    """
    stripped = day.strip()
    # Already a valid ISO date
    if stripped in CONFERENCE_DAYS:
        return stripped
    # Try alias lookup (case-insensitive)
    return _DAY_ALIASES.get(stripped.lower(), stripped)


def _condensed_session(session: dict, bookmarked_ids: set[str] | None = None) -> dict:
    """Build a condensed session dict (no description)."""
    d: dict = {
        "id": session["id"],
        "title": session.get("title", ""),
        "room": session.get("room"),
        "type": session.get("session_type"),
        "speakers": session.get("speaker_names") or [],
        "speaker_companies": session.get("speaker_companies") or [],
    }
    sched_url = session.get("sched_url")
    if sched_url:
        d["sched_url"] = sched_url
    if bookmarked_ids is not None:
        d["bookmarked"] = session["id"] in bookmarked_ids
    return d


def get_day_schedule(app: UpjackApp, day: str, track: str = "") -> dict:
    """Complete schedule for a day, grouped by time slot.

    Returns a condensed view with sessions grouped by start_time,
    sorted by room within each slot. No descriptions included.
    """
    day = resolve_day(day)

    # Get all sessions and filter by day
    all_sessions = app.list_entities("session", limit=500)
    sessions = [s for s in all_sessions if s.get("day") == day]

    # Apply track filter if provided
    if track:
        sessions = [s for s in sessions if s.get("track") == track]

    # Group by start_time
    time_slots_map: dict[str, list] = {}
    for session in sessions:
        time_slots_map.setdefault(session.get("start_time", ""), []).append(session)

    # Sort times, and within each slot sort by room
    time_slots = []
    for time_key in sorted(time_slots_map):
        slot_sessions = time_slots_map[time_key]
        slot_sessions.sort(key=lambda s: s.get("room") or "")
        time_slots.append(
            {
                "time": time_key,
                "sessions": [_condensed_session(s) for s in slot_sessions],
            }
        )

    label = DAY_LABELS.get(day, day)

    return {
        "day": day,
        "label": label,
        "time_slots": time_slots,
        "total_sessions": sum(len(ts["sessions"]) for ts in time_slots),
    }


def whats_on(
    app: UpjackApp,
    include_next: int = 2,
    track: str = "",
) -> dict:
    """Time-aware view: what's happening now and what's next.

    Uses Eastern Time to determine current sessions, upcoming slots,
    and the next break. Annotates sessions with bookmark status.
    """
    now = datetime.now(ET)
    today = now.strftime("%Y-%m-%d")

    # Check if today is a conference day
    if today not in CONFERENCE_DAYS:
        return {"message": "Conference runs April 1-3, 2026"}

    # Build bookmark set for annotation
    bookmarks = app.list_entities("bookmark")
    bookmarked_ids: set[str] = set()
    for bm in bookmarks:
        for rel in bm.get("relationships", []):
            if rel.get("rel") == "bookmarks":
                bookmarked_ids.add(rel["target"])

    # Get all sessions for today
    all_sessions = app.list_entities("session", limit=500)
    sessions = [s for s in all_sessions if s.get("day") == today]

    # Apply track filter
    if track:
        sessions = [s for s in sessions if s.get("track") == track]

    # Parse times for comparison
    now_time_str = now.strftime("%H:%M")

    # Find in-progress sessions: start_time <= now < end_time
    happening_now = []
    for s in sessions:
        if s.get("start_time", "") <= now_time_str < s.get("end_time", ""):
            happening_now.append(_condensed_session(s, bookmarked_ids))

    # Group all sessions by start_time for upcoming slots
    time_slots_map: dict[str, list] = {}
    for s in sessions:
        time_slots_map.setdefault(s.get("start_time", ""), []).append(s)

    # Find upcoming time slots (start_time > now)
    future_times = sorted(t for t in time_slots_map if t > now_time_str)
    up_next = []
    for time_key in future_times[:include_next]:
        slot_sessions = time_slots_map[time_key]
        slot_sessions.sort(key=lambda s: s.get("room") or "")
        up_next.append(
            {
                "time": time_key,
                "sessions": [_condensed_session(s, bookmarked_ids) for s in slot_sessions],
            }
        )

    # Find the next break session
    next_break = None
    for time_key in future_times:
        for s in time_slots_map[time_key]:
            if s.get("session_type") == "break":
                next_break = {"time": time_key, "label": s.get("title", "")}
                break
        if next_break:
            break

    # Also check currently running breaks if no future break found
    if next_break is None:
        for s in sessions:
            if s.get("session_type") == "break" and s.get("start_time", "") <= now_time_str < s.get(
                "end_time", ""
            ):
                next_break = {"time": s["start_time"], "label": s.get("title", "")}
                break

    current_time_display = now.strftime("%I:%M %p").lstrip("0") + " ET"

    return {
        "current_time": current_time_display,
        "day": today,
        "happening_now": happening_now,
        "up_next": up_next,
        "next_break": next_break,
    }
