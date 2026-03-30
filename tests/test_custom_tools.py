"""Tests for custom tool functions using real seed data."""

from mcp_dev_summit.tools.planner import check_conflicts, my_schedule
from mcp_dev_summit.tools.report import daily_briefing, post_conference_report
from mcp_dev_summit.tools.schedule import get_day_schedule
from mcp_dev_summit.tools.search import browse_sponsors, find_speakers, search_sessions

# ---------------------------------------------------------------------------
# search_sessions
# ---------------------------------------------------------------------------


def test_find_sessions_by_day(upjack_app):
    result = search_sessions(upjack_app, day="2026-04-02")
    assert result["total"] > 0, "Expected sessions on 2026-04-02"
    for session in result["results"]:
        assert session["day"] == "2026-04-02"


def test_find_sessions_by_query(upjack_app):
    result = search_sessions(upjack_app, query="OAuth")
    assert result["total"] >= 1, "Expected at least one OAuth-related session"
    # Verify at least one result has OAuth/auth in title (the most relevant hits)
    titles = [s.get("title", "").lower() for s in result["results"]]
    assert any("oauth" in t or "auth" in t for t in titles), (
        f"No title contains oauth/auth: {titles}"
    )


def test_find_sessions_by_speaker(upjack_app):
    result = search_sessions(upjack_app, company="Anthropic")
    assert result["total"] > 0, "Expected sessions with Anthropic speakers"
    assert result["filters_applied"]["company"] == "Anthropic"


# ---------------------------------------------------------------------------
# get_day_schedule
# ---------------------------------------------------------------------------


def test_get_day_schedule_groups_by_time(upjack_app):
    result = get_day_schedule(upjack_app, day="2026-04-02")
    assert len(result["time_slots"]) > 0, "Expected non-empty time slots"
    for slot in result["time_slots"]:
        assert "time" in slot
        assert "sessions" in slot
        assert len(slot["sessions"]) > 0


def test_get_day_schedule_day_label(upjack_app):
    result = get_day_schedule(upjack_app, day="2026-04-02")
    assert "Thursday" in result["label"]


# ---------------------------------------------------------------------------
# find_speakers
# ---------------------------------------------------------------------------


def test_find_speaker_profiles_by_company(upjack_app):
    result = find_speakers(upjack_app, company="Anthropic")
    assert result["total"] > 0, "Expected Anthropic speakers"
    for speaker in result["results"]:
        assert "anthropic" in speaker.get("company", "").lower()


def test_find_speaker_profiles_keynote_filter(upjack_app):
    result = find_speakers(upjack_app, is_keynote=True)
    assert result["total"] > 0, "Expected keynote speakers"
    for speaker in result["results"]:
        assert speaker["is_keynote"] is True


# ---------------------------------------------------------------------------
# browse_sponsors
# ---------------------------------------------------------------------------


def test_browse_sponsors_by_tier(upjack_app):
    result = browse_sponsors(upjack_app, tier="diamond")
    assert result["total"] > 0, "Expected diamond sponsors"
    for sponsor in result["results"]:
        assert sponsor["tier"] == "diamond"


def test_browse_sponsors_sorted_by_tier(upjack_app):
    result = browse_sponsors(upjack_app)
    assert result["total"] > 0, "Expected sponsors"
    first_tier = result["results"][0]["tier"]
    assert first_tier == "diamond", f"Expected first sponsor to be diamond, got {first_tier}"


# ---------------------------------------------------------------------------
# my_schedule / check_conflicts (no bookmarks)
# ---------------------------------------------------------------------------


def test_my_schedule_empty(upjack_app):
    result = my_schedule(upjack_app, day="2026-04-02")
    assert result["day"] == "2026-04-02"
    assert result["stats"]["sessions_booked"] == 0
    assert result["conflicts"] == []


def test_check_conflicts_no_bookmarks(upjack_app):
    result = check_conflicts(upjack_app)
    assert result["total_conflicts"] == 0
    assert result["conflicts"] == []


# ---------------------------------------------------------------------------
# daily_briefing / post_conference_report (no personal data)
# ---------------------------------------------------------------------------


def test_daily_briefing_empty(upjack_app):
    result = daily_briefing(upjack_app, day="2026-04-02")
    assert result["day"] == "2026-04-02"
    assert "greeting" in result
    assert isinstance(result["todays_sessions"], list)
    assert isinstance(result["todays_highlights"], list)


def test_post_conference_report_empty(upjack_app):
    result = post_conference_report(upjack_app, format="summary")
    assert result["format"] == "summary"
    assert result["stats"]["sessions_attended"] == 0
    assert result["stats"]["notes_captured"] == 0
    assert result["stats"]["connections_made"] == 0
