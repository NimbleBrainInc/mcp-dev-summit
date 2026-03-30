"""Search tools for browsing conference sessions, speakers, and sponsors."""

from __future__ import annotations

from upjack import UpjackApp

from .schedule import resolve_day

# Tier sort order (higher rank = listed first)
TIER_RANK = {"diamond": 0, "platinum": 1, "gold": 2, "startup": 3}


def _matches_text(haystack: str | list | None, needle: str) -> bool:
    """Case-insensitive substring match against a string or list of strings."""
    if not haystack or not needle:
        return False
    needle_lower = needle.lower()
    if isinstance(haystack, list):
        return any(needle_lower in str(item).lower() for item in haystack)
    return needle_lower in str(haystack).lower()


def search_sessions(
    app: UpjackApp,
    query: str = "",
    day: str = "",
    track: str = "",
    session_type: str = "",
    start_after: str = "",
    start_before: str = "",
    speaker: str = "",
    company: str = "",
    limit: int = 20,
) -> dict:
    """Full-text search across sessions with structured filters.

    Search by topic, speaker, company, or browse by day/track/type.
    Returns sessions with speaker details inlined.
    """
    if day:
        day = resolve_day(day)

    all_sessions = app.list_entities("session", limit=500)

    # Apply structured filters
    filtered = []
    for session in all_sessions:
        if day and session.get("day") != day:
            continue
        if track and session.get("track") != track:
            continue
        if session_type and session.get("session_type") != session_type:
            continue
        if start_after and (session.get("start_time", "") <= start_after):
            continue
        if start_before and (session.get("start_time", "") >= start_before):
            continue
        if speaker and not _matches_text(session.get("speaker_names"), speaker):
            continue
        if company and not _matches_text(session.get("speaker_companies"), company):
            continue

        # Full-text query: match on title, description, speaker_names, speaker_companies
        if query:
            searchable = " ".join(
                filter(
                    None,
                    [
                        session.get("title", ""),
                        session.get("description", ""),
                        " ".join(session.get("speaker_names") or []),
                        " ".join(session.get("speaker_companies") or []),
                    ],
                )
            )
            if not _matches_text(searchable, query):
                continue

        filtered.append(session)

    total = len(filtered)
    results = filtered[:limit]

    # Build filters_applied dict (only non-empty filters)
    filters_applied = {}
    if query:
        filters_applied["query"] = query
    if day:
        filters_applied["day"] = day
    if track:
        filters_applied["track"] = track
    if session_type:
        filters_applied["session_type"] = session_type
    if start_after:
        filters_applied["start_after"] = start_after
    if start_before:
        filters_applied["start_before"] = start_before
    if speaker:
        filters_applied["speaker"] = speaker
    if company:
        filters_applied["company"] = company

    session_dicts = []
    for session in results:
        d = dict(session)

        # Use denormalized speaker data (faster than relationship traversal)
        names = session.get("speaker_names", [])
        companies = session.get("speaker_companies", [])
        d["speakers"] = [
            {
                "name": names[i] if i < len(names) else "",
                "company": companies[i] if i < len(companies) else "",
            }
            for i in range(len(names))
        ]

        # Truncate description to 200 chars as preview
        if d.get("description"):
            desc = d["description"]
            if len(desc) > 200:
                d["description_preview"] = desc[:200] + "..."
            else:
                d["description_preview"] = desc
            del d["description"]
        else:
            d["description_preview"] = None

        session_dicts.append(d)

    return {
        "results": session_dicts,
        "total": total,
        "showing": len(session_dicts),
        "filters_applied": filters_applied,
    }


def find_speakers(
    app: UpjackApp,
    query: str = "",
    company: str = "",
    is_keynote: bool = False,
    limit: int = 20,
) -> dict:
    """Search speakers by name, company, or topic.

    Returns speaker profiles with their session details inlined.
    """
    all_speakers = app.list_entities("speaker", limit=200)

    filtered = []
    for spkr in all_speakers:
        if company and not _matches_text(spkr.get("company"), company):
            continue
        if is_keynote and not spkr.get("is_keynote"):
            continue
        if query:
            searchable = " ".join(
                filter(
                    None,
                    [
                        spkr.get("name", ""),
                        spkr.get("company", ""),
                        spkr.get("bio", ""),
                        " ".join(spkr.get("topics") or []),
                    ],
                )
            )
            if not _matches_text(searchable, query):
                continue
        filtered.append(spkr)

    results = filtered[:limit]

    speaker_dicts = []
    for spkr in results:
        d = dict(spkr)

        # Find sessions where this speaker presents (reverse lookup)
        sessions = app.query_by_relationship("session", "presented_by", spkr["id"])
        d["sessions"] = [
            {
                "id": s["id"],
                "title": s.get("title", ""),
                "day": s.get("day", ""),
                "start_time": s.get("start_time", ""),
            }
            for s in sessions
        ]

        speaker_dicts.append(d)

    return {
        "results": speaker_dicts,
        "total": len(speaker_dicts),
        "showing": len(speaker_dicts),
    }


def browse_sponsors(
    app: UpjackApp,
    tier: str = "",
    query: str = "",
) -> dict:
    """Browse sponsors by tier with booth activities and sponsored sessions.

    Returns sponsors sorted by tier rank (diamond > platinum > gold > startup).
    """
    all_sponsors = app.list_entities("sponsor", limit=100)

    filtered = []
    for sponsor in all_sponsors:
        if tier and sponsor.get("tier") != tier:
            continue
        if query:
            searchable = " ".join(
                filter(
                    None,
                    [
                        sponsor.get("name", ""),
                        sponsor.get("description", ""),
                        sponsor.get("tier", ""),
                    ],
                )
            )
            if not _matches_text(searchable, query):
                continue
        filtered.append(sponsor)

    # Sort by tier rank
    filtered.sort(key=lambda s: TIER_RANK.get(s.get("tier", ""), 99))

    sponsor_dicts = []
    for sponsor in filtered:
        d = dict(sponsor)

        # Find sponsored sessions (reverse lookup)
        sessions = app.query_by_relationship("session", "sponsored_by", sponsor["id"])
        d["sponsored_sessions"] = [
            {
                "id": s["id"],
                "title": s.get("title", ""),
                "day": s.get("day", ""),
                "start_time": s.get("start_time", ""),
            }
            for s in sessions
        ]

        sponsor_dicts.append(d)

    return {
        "results": sponsor_dicts,
        "total": len(sponsor_dicts),
        "showing": len(sponsor_dicts),
    }
