"""Planning tools for building personal schedules and detecting conflicts."""

from __future__ import annotations

from datetime import date

from upjack import UpjackApp

# Conference days
CONFERENCE_DAYS = ["2026-04-01", "2026-04-02", "2026-04-03"]

DAY_LABELS = {
    "2026-04-01": "Wednesday — Workshops & Tutorials",
    "2026-04-02": "Thursday — Main Conference Day 1",
    "2026-04-03": "Friday — Main Conference Day 2",
}

# Priority ranking (higher number = higher priority)
PRIORITY_RANK = {
    "must_attend": 3,
    "want_to_attend": 2,
    "maybe": 1,
    None: 0,
}


def _default_day() -> str:
    """Return the default day: today if it's a conference day, otherwise Apr 2."""
    today = date.today().isoformat()
    if today in CONFERENCE_DAYS:
        return today
    return "2026-04-02"


def _time_to_minutes(t: str) -> int:
    """Convert HH:MM string to minutes since midnight for comparison."""
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _times_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    """Check if two time ranges overlap: A.start < B.end AND B.start < A.end."""
    a_s = _time_to_minutes(a_start)
    a_e = _time_to_minutes(a_end)
    b_s = _time_to_minutes(b_start)
    b_e = _time_to_minutes(b_end)
    return a_s < b_e and b_s < a_e


def _overlap_range(a_start: str, a_end: str, b_start: str, b_end: str) -> str:
    """Compute the overlap range and describe it."""
    a_s = _time_to_minutes(a_start)
    a_e = _time_to_minutes(a_end)
    b_s = _time_to_minutes(b_start)
    b_e = _time_to_minutes(b_end)

    overlap_start = max(a_s, b_s)
    overlap_end = min(a_e, b_e)

    start_str = f"{overlap_start // 60:02d}:{overlap_start % 60:02d}"
    end_str = f"{overlap_end // 60:02d}:{overlap_end % 60:02d}"

    # Full overlap if one completely contains the other
    if (a_s <= b_s and a_e >= b_e) or (b_s <= a_s and b_e >= a_e):
        qualifier = "full overlap"
    else:
        qualifier = "partial overlap"

    return f"{start_str}-{end_str} ({qualifier})"


def _get_bookmark_session_id(bookmark: dict) -> str | None:
    """Extract the session ID from a bookmark's relationships."""
    for rel in bookmark.get("relationships", []):
        if rel.get("rel") == "bookmarks":
            return rel["target"]
    return None


def my_schedule(app: UpjackApp, day: str = "") -> dict:
    """Build a personal timeline from bookmarks for a given day.

    Interleaves break/social sessions, detects conflicts and room transitions,
    identifies gaps, and counts notes per session.
    """
    if not day:
        day = _default_day()

    label = DAY_LABELS.get(day, day)

    # Get all bookmarks
    all_bookmarks = app.list_entities("bookmark")

    # Get all sessions for the day
    all_sessions = app.list_entities("session", limit=500)
    day_sessions = [s for s in all_sessions if s.get("day") == day]
    day_session_map = {s["id"]: s for s in day_sessions}

    # Get all notes for counting
    all_notes = app.list_entities("note")

    # Build schedule entries from bookmarked sessions
    schedule = []
    bookmarked_session_ids = set()

    for bookmark in all_bookmarks:
        session_id = _get_bookmark_session_id(bookmark)
        if not session_id or session_id not in day_session_map:
            continue

        session = day_session_map[session_id]
        bookmarked_session_ids.add(session_id)

        # Count notes for this session
        notes_count = 0
        for note in all_notes:
            for rel in note.get("relationships", []):
                if rel.get("rel") == "about_session" and rel.get("target") == session_id:
                    notes_count += 1
                    break

        # Resolve speakers via relationship
        speakers = app.get_related(session_id, rel="presented_by")
        session_dict = dict(session)
        session_dict["speakers"] = [
            {"id": sp["id"], "name": sp.get("name", ""), "company": sp.get("company", "")}
            for sp in speakers
        ]

        schedule.append(
            {
                "time": f"{session['start_time']}-{session['end_time']}",
                "type": "session",
                "session": session_dict,
                "priority": bookmark.get("priority"),
                "notes_count": notes_count,
                "bookmark_id": bookmark["id"],
            }
        )

    # Add break/social sessions
    break_sessions = [s for s in day_sessions if s.get("session_type") in ("break", "social")]
    for session in break_sessions:
        if session["id"] not in bookmarked_session_ids:
            schedule.append(
                {
                    "time": f"{session['start_time']}-{session['end_time']}",
                    "type": "break",
                    "label": session.get("title", ""),
                    "session_id": session["id"],
                }
            )

    # Sort by start time
    schedule.sort(key=lambda e: e["time"])

    # Detect conflicts among bookmarked sessions
    conflicts = []
    booked_entries = [e for e in schedule if e["type"] == "session"]

    for i in range(len(booked_entries)):
        for j in range(i + 1, len(booked_entries)):
            a = booked_entries[i]
            b = booked_entries[j]
            a_session = a["session"]
            b_session = b["session"]

            if _times_overlap(
                a_session["start_time"],
                a_session["end_time"],
                b_session["start_time"],
                b_session["end_time"],
            ):
                conflicts.append(
                    {
                        "session_a": {
                            "id": a_session["id"],
                            "title": a_session.get("title", ""),
                            "time": a["time"],
                            "priority": a["priority"],
                        },
                        "session_b": {
                            "id": b_session["id"],
                            "title": b_session.get("title", ""),
                            "time": b["time"],
                            "priority": b["priority"],
                        },
                        "overlap": _overlap_range(
                            a_session["start_time"],
                            a_session["end_time"],
                            b_session["start_time"],
                            b_session["end_time"],
                        ),
                    }
                )

    # Flag room transitions (< 5 min gap between consecutive sessions in different rooms)
    for i in range(len(booked_entries) - 1):
        curr = booked_entries[i]
        nxt = booked_entries[i + 1]
        curr_session = curr["session"]
        nxt_session = nxt["session"]

        curr_end = _time_to_minutes(curr_session["end_time"])
        nxt_start = _time_to_minutes(nxt_session["start_time"])
        gap_min = nxt_start - curr_end

        if (
            0 <= gap_min < 5
            and curr_session.get("room")
            and nxt_session.get("room")
            and curr_session["room"] != nxt_session["room"]
        ):
            curr["room_transition_warning"] = (
                f"Only {gap_min} min to move from {curr_session['room']} to {nxt_session['room']}"
            )

    # Identify free slots (gaps > 30 min between bookmarked sessions)
    free_slots = 0
    for i in range(len(booked_entries) - 1):
        curr = booked_entries[i]
        nxt = booked_entries[i + 1]
        curr_end = _time_to_minutes(curr["session"]["end_time"])
        nxt_start = _time_to_minutes(nxt["session"]["start_time"])
        gap_min = nxt_start - curr_end
        if gap_min > 30:
            free_slots += 1

    # Count total notes across all bookmarked sessions
    total_notes = sum(e["notes_count"] for e in schedule if e["type"] == "session")

    return {
        "day": day,
        "label": label,
        "schedule": schedule,
        "conflicts": conflicts,
        "stats": {
            "sessions_booked": len(booked_entries),
            "conflicts": len(conflicts),
            "free_slots": free_slots,
            "notes_captured": total_notes,
        },
    }


def check_conflicts(app: UpjackApp, bookmark_id: str = "") -> dict:
    """Check for time conflicts between bookmarked sessions.

    If bookmark_id is given, checks only that bookmark against all others.
    Otherwise checks all bookmark pairs across all days.
    """
    all_bookmarks = app.list_entities("bookmark")

    # Resolve sessions for all bookmarks
    bookmark_with_sessions: list[tuple[dict, dict]] = []
    for b in all_bookmarks:
        session_id = _get_bookmark_session_id(b)
        if not session_id:
            continue
        session = app.get_entity("session", session_id)
        if session:
            bookmark_with_sessions.append((b, session))

    # Filter to check specific bookmark if requested
    if bookmark_id:
        target = None
        others = []
        for b, s in bookmark_with_sessions:
            if b["id"] == bookmark_id:
                target = (b, s)
            else:
                others.append((b, s))

        if target is None:
            return {
                "conflicts": [],
                "total_conflicts": 0,
                "clean_days": list(CONFERENCE_DAYS),
                "error": f"Bookmark {bookmark_id} not found",
            }

        pairs_to_check = [(target, other) for other in others]
    else:
        # Check all pairs
        pairs_to_check = []
        for i in range(len(bookmark_with_sessions)):
            for j in range(i + 1, len(bookmark_with_sessions)):
                pairs_to_check.append((bookmark_with_sessions[i], bookmark_with_sessions[j]))

    conflicts = []
    days_with_conflicts: set[str] = set()

    for (b_a, s_a), (b_b, s_b) in pairs_to_check:
        # Only check sessions on the same day
        if s_a.get("day") != s_b.get("day"):
            continue

        if _times_overlap(s_a["start_time"], s_a["end_time"], s_b["start_time"], s_b["end_time"]):
            days_with_conflicts.add(s_a["day"])

            # Determine suggestion based on priority
            rank_a = PRIORITY_RANK.get(b_a.get("priority"), 0)
            rank_b = PRIORITY_RANK.get(b_b.get("priority"), 0)

            if rank_a > rank_b:
                suggestion = f"Keep '{s_a['title']}' (higher priority: {b_a['priority']})"
            elif rank_b > rank_a:
                suggestion = f"Keep '{s_b['title']}' (higher priority: {b_b['priority']})"
            else:
                suggestion = "Same priority — review both and choose based on interest"

            conflicts.append(
                {
                    "bookmark_a": {
                        "id": b_a["id"],
                        "session_title": s_a.get("title", ""),
                        "priority": b_a.get("priority"),
                        "time": f"{s_a['start_time']}-{s_a['end_time']}",
                    },
                    "bookmark_b": {
                        "id": b_b["id"],
                        "session_title": s_b.get("title", ""),
                        "priority": b_b.get("priority"),
                        "time": f"{s_b['start_time']}-{s_b['end_time']}",
                    },
                    "overlap": _overlap_range(
                        s_a["start_time"], s_a["end_time"], s_b["start_time"], s_b["end_time"]
                    ),
                    "suggestion": suggestion,
                }
            )

    # Determine which conference days have bookmarks
    days_with_bookmarks = {s.get("day") for _, s in bookmark_with_sessions}
    # Clean days = days with bookmarks but no conflicts
    all_relevant_days = days_with_bookmarks | set(CONFERENCE_DAYS)
    clean_days = sorted(all_relevant_days - days_with_conflicts)

    return {
        "conflicts": conflicts,
        "total_conflicts": len(conflicts),
        "clean_days": clean_days,
    }
