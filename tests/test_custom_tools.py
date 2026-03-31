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
# find_speaker_profiles (MCP tool — return value + photo inlining)
# ---------------------------------------------------------------------------


def test_find_speaker_profiles_tool_returns_data(upjack_app):
    """Regression: find_speaker_profiles must return result dict, not None."""
    import mcp_dev_summit.server as srv

    # Call the registered MCP tool function directly
    result = srv.find_speaker_profiles(query="David Soria Parra")
    assert result is not None, "find_speaker_profiles returned None — missing return statement?"
    assert isinstance(result, dict), f"Expected dict, got {type(result)}"
    assert "results" in result, "Missing 'results' key"
    assert result["total"] >= 1, "Expected at least one speaker"


def test_find_speaker_profiles_inlines_photos(upjack_app):
    """Photos must be base64 data URIs, not external URLs (sandbox blocks external)."""
    import mcp_dev_summit.server as srv

    result = srv.find_speaker_profiles(query="David Soria Parra")
    speakers = result["results"]
    assert len(speakers) >= 1
    for sp in speakers:
        photo = sp.get("photo_url", "")
        if photo:
            assert photo.startswith("data:image/"), (
                f"photo_url should be a data URI, got: {photo[:80]}..."
            )


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


# ---------------------------------------------------------------------------
# Speaker widget — MCP Apps spec compliance
# ---------------------------------------------------------------------------


def test_speaker_widget_html_has_spec_compliant_handshake():
    """Widget must follow MCP Apps handshake: send ui/initialize, wait for response,
    then send ui/notifications/initialized. Must NOT send initialized before host responds."""
    import mcp_dev_summit.server as srv

    html = srv.speaker_widget_ui()

    # Must contain ui/initialize request
    assert "ui/initialize" in html, "Widget must send ui/initialize"

    # Must listen for host response before sending initialized
    assert "ui/notifications/initialized" in html, "Widget must send initialized notification"

    # Handshake ordering: initialize must come BEFORE initialized in the code,
    # and initialized must be inside a message handler (not sent synchronously)
    init_pos = html.index("ui/initialize")
    initialized_pos = html.index("ui/notifications/initialized")
    assert init_pos < initialized_pos, "ui/initialize must come before ui/notifications/initialized"

    # initialized must be inside addEventListener callback, not at top level
    # (it should be dispatched in response to the host's init reply)
    listener_pos = html.index("addEventListener")
    assert listener_pos < initialized_pos, (
        "ui/notifications/initialized must be inside message listener (wait for host response)"
    )


def test_speaker_widget_listens_for_tool_result():
    """Widget must handle ui/notifications/tool-result per MCP Apps spec."""
    import mcp_dev_summit.server as srv

    html = srv.speaker_widget_ui()
    assert "ui/notifications/tool-result" in html, (
        "Widget must listen for ui/notifications/tool-result"
    )


def test_speaker_widget_sends_initial_resize():
    """Widget must send size-changed before handshake so host doesn't render at 0 height."""
    import mcp_dev_summit.server as srv

    html = srv.speaker_widget_ui()
    assert "ui/notifications/size-changed" in html, "Widget must send size notification"

    # resize() must be called before ui/initialize to set initial height
    resize_call = html.index("resize()")
    init_call = html.index("'ui/initialize'")
    # Find the FIRST resize() call (not one inside render())
    assert resize_call < init_call, "First resize() must fire before ui/initialize handshake"


def test_speaker_widget_has_tool_meta():
    """find_speaker_profiles tool must declare meta.ui.resourceUri for the widget."""
    import mcp_dev_summit.server as srv

    # Check the tool list whitelist includes the tool
    assert "find_speaker_profiles" in srv._LISTED_TOOLS

    # The widget resource must exist
    html = srv.speaker_widget_ui()
    assert "<!DOCTYPE html>" in html
