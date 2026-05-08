"""MCP Dev Summit Companion — Upjack Server."""

import json
import logging
import os
import sys
from importlib.resources import files
from pathlib import Path
from typing import Any

from starlette.requests import Request
from starlette.responses import JSONResponse
from upjack import UpjackApp
from upjack.server import create_server

from .ui import load_ui

# Logging to stderr only
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("mcp_dev_summit")

# Mode detection
MODE = os.environ.get("MCP_SUMMIT_MODE", "local")

# Paths
MANIFEST = Path(__file__).parent.parent.parent / "manifest.json"
_SYNAPSE_JS = files("mcp_dev_summit").joinpath("synapse.js").read_text()

# Create Upjack server (root from UPJACK_ROOT env var or .upjack default)
mcp = create_server(str(MANIFEST))

# Override the generic Upjack instructions with conference-specific ones
mcp.instructions = (
    "You are the MCP Dev Summit Companion — a conference assistant for the "
    "MCP Dev Summit North America (April 1-3, 2026, NYC). You have complete data "
    "about all 145 sessions, 144 speakers, and 52 sponsors.\n\n"
    "ALWAYS use your tools for questions about the conference, speakers, sessions, "
    "or schedule. Never search the web — your data is authoritative.\n\n"
    "Key tools:\n"
    "- find_speaker_profiles: ALWAYS use this for speaker lookups (renders a rich profile card). "
    "Do NOT use get_speaker — it returns raw data without a visual card.\n"
    "- find_sessions: search talks by topic, speaker, track, day\n"
    "- get_day_schedule: full schedule for a day\n"
    "- whats_on: what's happening now/next\n"
    "- browse_sponsors: sponsor directory by tier\n"
    "- bookmark_session(session_id): add a session to the user's personal schedule "
    "(use this — it links the bookmark to the session). list_bookmarks / delete_bookmark "
    "for read/remove.\n"
    "- create_note / list_notes: capture session notes\n"
    "- create_connection: track people you meet"
)

# Create UpjackApp instance for custom tool data access
from upjack.paths import resolve_root  # noqa: E402

WORKSPACE = resolve_root()
upjack_app = UpjackApp.from_manifest(str(MANIFEST), root=str(WORKSPACE))

# ---------------------------------------------------------------------------
# Tool visibility whitelist. Upjack 0.4.0's per-entity tools filter excludes
# custom tools (bug filed). We override with our own complete whitelist.
# Strips outputSchema for Claude Desktop 1.x compat.
# ---------------------------------------------------------------------------
_LISTED_TOOLS: set[str] = {
    # Entity CRUD (from manifest tools arrays)
    "get_session",
    "create_bookmark",
    "list_bookmarks",
    "delete_bookmark",
    "bookmark_session",
    "create_note",
    "list_notes",
    "update_note",
    "create_connection",
    "list_connections",
    "update_connection",
    "seed_data",
    # Custom tools
    "find_sessions",
    "get_day_schedule",
    "whats_on",
    "find_speaker_profiles",
    "browse_sponsors",
    "my_schedule",
    "check_conflicts",
    "daily_briefing",
    "post_conference_report",
}

# Grab the ORIGINAL _list_tools before Upjack's filter (need the unfiltered list)
# Upjack already patched it, so we go through FastMCP's base class method


async def _list_all_tools(self: Any) -> Any:
    """Call FastMCP's original _list_tools, bypassing Upjack's filter."""
    from fastmcp import FastMCP as _FastMCP

    return await _FastMCP._list_tools(self)


async def _patched_list_tools() -> Any:
    all_tools = await _list_all_tools(mcp)
    visible = [t for t in all_tools if t.name in _LISTED_TOOLS]
    for t in visible:
        if hasattr(t, "output_schema"):
            t.output_schema = None
    return visible


mcp._list_tools = _patched_list_tools  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

# Auto-seed reference data if workspace is empty
_session_dir = WORKSPACE / "apps" / "mcp-dev-summit" / "data" / "sessions"
if not _session_dir.exists() or not any(_session_dir.iterdir()):
    import json

    _seed_dir = MANIFEST.parent / "seed"
    logger.info("Seeding reference data from %s", _seed_dir)
    _schema_logger = logging.getLogger("upjack.schema")
    _schema_level = _schema_logger.level
    _schema_logger.setLevel(logging.ERROR)

    # Seed order: speakers/sponsors first (so session relationship targets exist)
    _seed_order = [
        ("speaker", "speakers.json"),
        ("sponsor", "sponsors.json"),
        ("session", "sessions.json"),
    ]
    for entity_type, filename in _seed_order:
        _path = _seed_dir / filename
        if _path.exists():
            for record in json.loads(_path.read_text()):
                try:
                    upjack_app.create_entity(entity_type, record, created_by="system")
                except Exception as e:
                    logger.warning("Seed error (%s): %s", entity_type, e)

    logger.info(
        "Seeded: %d sessions, %d speakers, %d sponsors",
        len(list(_session_dir.iterdir())) if _session_dir.exists() else 0,
        len(list((WORKSPACE / "apps" / "mcp-dev-summit" / "data" / "speakers").iterdir()))
        if (WORKSPACE / "apps" / "mcp-dev-summit" / "data" / "speakers").exists()
        else 0,
        len(list((WORKSPACE / "apps" / "mcp-dev-summit" / "data" / "sponsors").iterdir()))
        if (WORKSPACE / "apps" / "mcp-dev-summit" / "data" / "sponsors").exists()
        else 0,
    )
    _schema_logger.setLevel(_schema_level)


# =============================================================================
# Resources
# =============================================================================


@mcp.resource("ui://mcp-dev-summit/speaker-widget")
def speaker_widget_ui() -> str:
    """Speaker card widget using Synapse.connect() for MCP Apps protocol."""
    synapse_js = _SYNAPSE_JS
    return (
        '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8">\n'
        f"<style>{_WIDGET_CSS}</style>\n"
        "</head><body>\n"
        '<div id="root"><p class="empty">Loading speakers&hellip;</p></div>\n'
        f"<script>{synapse_js}</script>\n"
        f"<script>{_WIDGET_THEME_BOOT}</script>\n"
        """<script>
(function(){
  var app;
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  function render(speakers){
    var root=document.getElementById('root');
    if(!speakers||!speakers.length){root.innerHTML='<p class="empty">No speakers found.</p>';if(app)app.resize();return;}
    var shown=speakers.slice(0,3);
    var overflow=speakers.length-shown.length;
    var html='';
    shown.forEach(function(sp){
      var name=esc(sp.name||'');
      var role=esc(sp.role||'');
      var company=esc(sp.company||'');
      var bio=(sp.bio||'').substring(0,200);
      if((sp.bio||'').length>200){bio=bio.substring(0,bio.lastIndexOf(' ')||200)+'\\u2026';}
      bio=esc(bio);
      var photo=sp.photo_url||'';
      var topics=(sp.topics||[]).slice(0,3);
      var sessions=(sp.sessions||[]).slice(0,2);
      var linkedin=sp.linkedin_url||'';

      var photoH=photo
        ?'<img src="'+photo+'" class="photo" alt="">'
        :'<div class="initial">'+(name.charAt(0)||'?')+'</div>';

      var subtitle=(role?role+', ':'')+company;
      var nameRow='<span>'+name+'</span>';
      if(linkedin){nameRow+='<a href="#" class="link" data-li="1">LinkedIn \\u2197</a>';}

      var topicsH='';
      if(topics.length){topicsH='<div class="tags">'+topics.map(function(t){return'<span class="tag">'+esc(t)+'</span>';}).join('')+'</div>';}

      var sessH='';
      if(sessions.length){
        sessH='<div class="label">Sessions</div>'+sessions.map(function(s){
          return'<div class="sess"><span class="sess-time">'+esc((s.day||'').slice(-5))+' '+esc(s.start_time||'')+'</span><span>'+esc(s.title||'')+'</span></div>';
        }).join('');
      }

      html+='<div class="spk-row"><div class="spk-head">'+photoH+'<div style="min-width:0">'
        +'<div class="name">'+nameRow+'</div>'
        +(subtitle?'<div class="role">'+subtitle+'</div>':'')
        +(bio?'<div class="bio">'+bio+'</div>':'')
        +topicsH
        +sessH
        +'</div></div></div>';
    });
    if(overflow>0){html+='<div class="more">+'+overflow+' more speaker'+(overflow>1?'s':'')+'</div>';}
    root.innerHTML=html;

    var liLinks=root.querySelectorAll('a[data-li]');
    shown.forEach(function(sp,i){
      if(sp.linkedin_url&&liLinks[i]){liLinks[i].onclick=function(e){e.preventDefault();e.stopPropagation();app&&app.openLink(sp.linkedin_url);};}
    });
    if(app)app.resize();
  }

  Synapse.connect({
    name:'speaker-widget',version:'1.0.0',autoResize:false,
    on:{
      'tool-result':function(data){
        var d=data.content;
        var speakers=(d&&d.results)||[];
        if(speakers.length)render(speakers);
      },
      'theme-changed':function(t){applyTheme(t);}
    }
  }).then(function(a){ app=a; applyTheme(a.theme); });
})();
</script>
</body></html>"""
    )


@mcp.resource("ui://mcp-dev-summit/session-widget")
def session_widget_ui() -> str:
    """Session search results widget using Synapse.connect() for MCP Apps protocol."""
    synapse_js = _SYNAPSE_JS
    return (
        '<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8">\n'
        f"<style>{_WIDGET_CSS}</style>\n"
        "</head><body>\n"
        '<div id="root"><p class="empty">Loading sessions&hellip;</p></div>\n'
        f"<script>{synapse_js}</script>\n"
        f"<script>{_WIDGET_THEME_BOOT}</script>\n"
        """<script>
(function(){
  var app;
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  function fmtTime(start,end){
    if(!start) return '';
    if(!end) return start;
    return start+'\\u2013'+end;
  }

  function render(sessions){
    var root=document.getElementById('root');
    if(!sessions||!sessions.length){root.innerHTML='<p class="empty">No sessions found.</p>';if(app)app.resize();return;}
    var shown=sessions.slice(0,10);
    var overflow=sessions.length-shown.length;
    var html='<div class="meta">'+sessions.length+' '+(sessions.length===1?'session':'sessions')+'</div>';
    shown.forEach(function(s){
      var title=esc(s.title||'');
      var stype=s.session_type||s.type||'';
      var room=esc(s.room||'');
      var day=(s.day||'').slice(-5);
      var time=fmtTime(s.start_time||'',s.end_time||'');
      var speakers=(s.speakers||[]).map(function(sp){return esc(sp.name||'');}).join(', ');
      if(!speakers) speakers=(s.speaker_names||[]).map(function(n){return esc(n);}).join(', ');
      var desc=esc((s.description_preview||'').slice(0,140));
      var isKeynote=stype==='keynote';

      html+='<div class="sess-row" data-keynote="'+isKeynote+'">';
      html+='<div class="sess-title">'+title+'</div>';
      html+='<div class="sess-info">';
      if(stype) html+='<span class="badge badge-'+stype+'">'+esc(stype.replace(/_/g,' '))+'</span>';
      if(room) html+='<span class="sess-room">'+room+'</span>';
      if(day||time) html+='<span class="sess-time-r">'+esc(day)+(day&&time?' \\u00b7 ':'')+esc(time)+'</span>';
      html+='</div>';
      if(speakers) html+='<div class="sess-speakers">'+speakers+'</div>';
      if(desc) html+='<div class="sess-speakers" style="margin-top:4px">'+desc+'\\u2026</div>';
      html+='</div>';
    });
    if(overflow>0) html+='<div class="more">+ '+overflow+' more</div>';
    root.innerHTML=html;
    if(app)app.resize();
  }

  Synapse.connect({
    name:'session-widget',version:'1.0.0',autoResize:false,
    on:{
      'tool-result':function(data){
        var d=data.content;
        var sessions=(d&&d.results)||[];
        if(sessions.length)render(sessions);
      },
      'theme-changed':function(t){applyTheme(t);}
    }
  }).then(function(a){ app=a; applyTheme(a.theme); });
})();
</script>
</body></html>"""
    )


@mcp.resource("ui://mcp-dev-summit/schedule-widget/{cache_bust}")
def schedule_widget_ui(cache_bust: str = "") -> str:
    """Day schedule widget."""
    schedule = _last_widget_data.get("schedule", {})
    if not schedule:
        return "<html><body><p>No schedule</p></body></html>"
    return _wrap_widget(_render_schedule(schedule), "schedule-widget")


@mcp.resource("ui://mcp-dev-summit/main")
def summit_ui() -> str:
    """The MCP Dev Summit Companion UI — rendered in the platform sidebar."""
    return load_ui()


@mcp.resource("ui://mcp-dev-summit/speaker/{speaker_id}")
def speaker_card_ui(speaker_id: str) -> str:
    """A speaker profile card — rendered inline when a speaker is looked up."""
    import html as html_mod

    try:
        sp = upjack_app.get_entity("speaker", speaker_id)
    except Exception:
        return _wrap_widget('<p class="empty">Speaker not found.</p>', "speaker-card")

    try:
        sessions = upjack_app.query_by_relationship("session", "presented_by", speaker_id)
    except Exception:
        sessions = []

    photo = sp.get("photo_url", "")
    name = html_mod.escape(sp.get("name", "Unknown"))
    role = html_mod.escape(sp.get("role", ""))
    company = html_mod.escape(sp.get("company", ""))
    bio = html_mod.escape(sp.get("bio", ""))
    topics = sp.get("topics", [])
    linkedin = sp.get("linkedin_url", "")

    avatar = (
        f'<img class="photo" src="{html_mod.escape(photo)}" alt="{name}">'
        if photo
        else f'<div class="initial">{name[:1] or "?"}</div>'
    )

    subtitle = f"{role + ', ' if role else ''}{company}"

    name_row = f"<span>{name}</span>"
    if linkedin:
        name_row += (
            f'<a href="#" class="link" onclick="window._app&&window._app.openLink(&quot;{linkedin}&quot;);'
            f'return false">LinkedIn ↗</a>'
        )

    topics_html = ""
    if topics:
        chips = "".join(f'<span class="tag">{html_mod.escape(t)}</span>' for t in topics)
        topics_html = f'<div class="label">Topics</div><div class="tags">{chips}</div>'

    sessions_html = ""
    if sessions:
        rows = "".join(
            f'<div class="sess"><span class="sess-time">'
            f"{html_mod.escape(s.get('day', '')[-5:])} {html_mod.escape(s.get('start_time', ''))}"
            f"</span><span>{html_mod.escape(s.get('title', ''))}</span></div>"
            for s in sessions
        )
        sessions_html = f'<div class="label">Sessions</div>{rows}'

    body = (
        '<div class="spk-row"><div class="spk-head">'
        f"{avatar}"
        '<div style="min-width:0">'
        f'<div class="name">{name_row}</div>'
        f"{f'<div class=role>{subtitle}</div>' if subtitle else ''}"
        f"{f'<div class=bio>{bio}</div>' if bio else ''}"
        f"{topics_html}"
        f"{sessions_html}"
        "</div></div></div>"
    )

    return _wrap_widget(body, "speaker-card")


# Shared state for baked-in widget data. The tool stores its result here,
# and the resource reads it when Claude Desktop fetches the widget HTML.
_last_widget_data: dict[str, Any] = {}

_WIDGET_CSS = """\
:root[data-theme="light"]{
  --w-ink:#0c111c; --w-ink-2:#4a5468; --w-ink-3:#8b95a8;
  --w-rule:#e5e8ee; --w-rule-soft:#eef0f4;
  --w-surface-2:#f8f9fb; --w-surface-3:#eef0f4;
  --w-accent:var(--color-text-accent,#4f46e5);
  --w-accent-soft:color-mix(in srgb, var(--w-accent) 10%, transparent);
  --w-accent-line:color-mix(in srgb, var(--w-accent) 28%, transparent);
}
:root[data-theme="dark"]{
  --w-ink:#e7ecf3; --w-ink-2:#98a3b8; --w-ink-3:#5e6b82;
  --w-rule:#1e2840; --w-rule-soft:#161e2e;
  --w-surface-2:#131a28; --w-surface-3:#1c2536;
  --w-accent:var(--color-text-accent,#818cf8);
  --w-accent-soft:color-mix(in srgb, var(--w-accent) 14%, transparent);
  --w-accent-line:color-mix(in srgb, var(--w-accent) 35%, transparent);
}
*{box-sizing:border-box}
body{padding:12px;background:transparent;color:var(--w-ink);
  font-family:var(--font-sans,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  font-size:13px;line-height:1.5;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.meta{font-size:11px;color:var(--w-ink-3);text-transform:uppercase;letter-spacing:0.08em;
  font-weight:600;margin-bottom:10px;font-variant-numeric:tabular-nums}
.empty{color:var(--w-ink-3);font-size:13px;padding:8px 0}
.more{font-size:11px;color:var(--w-ink-3);margin-top:8px;font-style:italic}

/* ---------- speaker rows ---------- */
.spk-row{padding:10px 0;border-bottom:1px solid var(--w-rule-soft)}
.spk-row:last-child{border-bottom:none;padding-bottom:0}
.spk-row:first-child{padding-top:0}
.spk-head{display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:flex-start}
.photo{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--w-surface-3)}
.initial{width:40px;height:40px;border-radius:50%;flex-shrink:0;
  background:var(--w-accent-soft);color:var(--w-accent);
  display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600}
.name{font-size:14px;font-weight:600;color:var(--w-ink);
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;line-height:1.3}
.role{font-size:12px;color:var(--w-ink-2);margin-top:1px;line-height:1.4}
.bio{font-size:12.5px;line-height:1.5;color:var(--w-ink-2);margin:6px 0 0;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.tag{display:inline-block;padding:1px 7px;border-radius:3px;
  background:var(--w-surface-2);color:var(--w-ink-3);font-size:10.5px;font-weight:500}
.label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;
  color:var(--w-ink-3);margin:8px 0 4px;font-weight:600}
.sess{font-size:12px;color:var(--w-ink-2);padding:2px 0;
  display:flex;gap:8px;align-items:baseline}
.sess-time{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  color:var(--w-ink-3);font-variant-numeric:tabular-nums;flex-shrink:0;font-size:11.5px}
.link,.link:visited,.link:active{color:var(--w-accent);text-decoration:none;
  font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:2px}
.link:hover{text-decoration:underline}
.row-link{margin-top:6px}

/* ---------- session rows ---------- */
.sess-row{padding:11px 0;border-bottom:1px solid var(--w-rule-soft);position:relative}
.sess-row:last-child{border-bottom:none;padding-bottom:0}
.sess-row:first-of-type{padding-top:0}
.sess-row[data-keynote="true"]::before{content:"";position:absolute;left:-12px;top:0;bottom:0;
  width:3px;background:var(--w-accent)}
.sess-title{font-size:14px;font-weight:500;color:var(--w-ink);line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sess-title.link{font-weight:500;font-size:14px;display:block}
.sess-info{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;
  font-size:12px;color:var(--w-ink-2);align-items:baseline}
.sess-time-r{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  color:var(--w-ink-3);font-size:11.5px;font-variant-numeric:tabular-nums}
.sess-room{color:var(--w-ink-2)}
.sess-speakers{font-size:12px;color:var(--w-ink-3);margin-top:2px;line-height:1.4}

/* ---------- badges ---------- */
.badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;
  text-transform:uppercase;letter-spacing:0.06em;padding:2px 6px;border-radius:4px;
  background:var(--w-surface-3);color:var(--w-ink-2);white-space:nowrap;vertical-align:middle}
.badge-keynote{background:var(--w-accent-soft);color:var(--w-accent)}
.badge-workshop{background:color-mix(in srgb,#15803d 14%,transparent);color:#15803d}
.badge-social{background:color-mix(in srgb,#ec4899 14%,transparent);color:#ec4899}
.badge-sponsor_activity{background:color-mix(in srgb,#b45309 14%,transparent);color:#b45309}

/* ---------- schedule ---------- */
.day-head{font-size:14px;font-weight:600;color:var(--w-ink);margin-bottom:12px;
  letter-spacing:0.01em}
.time-slot{display:flex;align-items:baseline;gap:10px;
  margin:14px 0 4px;padding:6px 0 6px;border-bottom:1px solid var(--w-rule)}
.time-slot:first-of-type{margin-top:0}
.time-slot-time{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  font-size:11.5px;font-weight:600;letter-spacing:0.02em;color:var(--w-ink);
  font-variant-numeric:tabular-nums}
.schedule-item{padding:7px 0;border-bottom:1px solid var(--w-rule-soft);
  font-size:13px;color:var(--w-ink);position:relative}
.schedule-item:last-child{border-bottom:none}
.schedule-item[data-keynote="true"]::before{content:"";position:absolute;left:-12px;top:0;bottom:0;
  width:3px;background:var(--w-accent)}
.schedule-title{display:block;font-size:13.5px;line-height:1.35;color:var(--w-ink);font-weight:500}
.schedule-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:3px;
  font-size:11.5px;color:var(--w-ink-2);align-items:baseline}
.schedule-room{color:var(--w-ink-3)}
.schedule-speakers{font-size:11.5px;color:var(--w-ink-3);margin-top:2px;line-height:1.4}
"""

# Boot snippet for chat widgets: applies data-theme based on host theme so the
# widget palette adapts when the user toggles light/dark.
_WIDGET_THEME_BOOT = """\
function applyTheme(t){
  var mode=(t&&t.mode==="dark")?"dark":"light";
  document.documentElement.setAttribute("data-theme",mode);
}
"""


def _wrap_widget(body_html: str, widget_name: str = "widget") -> str:
    synapse_js = _SYNAPSE_JS
    widget_js = (
        f"{_WIDGET_THEME_BOOT}"
        f"Synapse.connect({{name:'{widget_name}',version:'1.0.0',autoResize:true,"
        f"on:{{'theme-changed':function(t){{applyTheme(t);}}}}"
        f"}}).then(function(a){{ applyTheme(a.theme); window._app=a; }});"
    )
    return (
        "<!DOCTYPE html><html data-theme='light'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<style>{_WIDGET_CSS}</style></head>"
        f"<body>{body_html}"
        f"<script>{synapse_js}</script>"
        f"<script>{widget_js}</script>"
        "</body></html>"
    )


def _render_session_list(sessions: list[dict]) -> str:
    import html as html_mod

    h = f'<div class="meta">{len(sessions)} {"session" if len(sessions) == 1 else "sessions"}</div>'
    for s in sessions[:10]:
        title = html_mod.escape(s.get("title", ""))
        stype = s.get("session_type", "")
        room = html_mod.escape(s.get("room", ""))
        start = html_mod.escape(s.get("start_time", ""))
        end = html_mod.escape(s.get("end_time", ""))
        day = html_mod.escape(s.get("day", "")[-5:])
        sched_url = s.get("sched_url", "")
        speakers = ", ".join(html_mod.escape(sp.get("name", "")) for sp in s.get("speakers", []))
        if not speakers:
            speakers = ", ".join(html_mod.escape(n) for n in s.get("speaker_names", []))
        desc = html_mod.escape(s.get("description_preview", "")[:140])
        is_keynote = stype == "keynote"
        time_str = f"{start}–{end}" if start and end else start

        if sched_url:
            title_html = (
                f'<a href="#" onclick="window._app&&window._app.openLink(&quot;{sched_url}&quot;);'
                f'return false" class="sess-title link">{title}</a>'
            )
        else:
            title_html = f'<div class="sess-title">{title}</div>'

        meta_parts = []
        if stype:
            meta_parts.append(
                f'<span class="badge badge-{stype}">{html_mod.escape(stype.replace("_", " "))}</span>'
            )
        if room:
            meta_parts.append(f'<span class="sess-room">{room}</span>')
        if day or time_str:
            sep = " · " if day and time_str else ""
            meta_parts.append(f'<span class="sess-time-r">{day}{sep}{time_str}</span>')

        h += (
            f'<div class="sess-row" data-keynote="{str(is_keynote).lower()}">'
            f"{title_html}"
            f'<div class="sess-info">{"".join(meta_parts)}</div>'
            f"{f'<div class=sess-speakers>{speakers}</div>' if speakers else ''}"
            f"{f'<div class=sess-speakers style=margin-top:4px>{desc}&hellip;</div>' if desc else ''}"
            f"</div>"
        )
    return h


def _render_schedule(data: dict) -> str:
    import html as html_mod

    slots = data.get("time_slots", [])
    label = html_mod.escape(data.get("label", data.get("day", "Schedule")))
    h = f'<div class="day-head">{label}</div>'
    for slot in slots:
        slot_time = html_mod.escape(slot.get("time", ""))
        h += f'<div class="time-slot"><span class="time-slot-time">{slot_time}</span></div>'
        for s in slot.get("sessions", []):
            title = html_mod.escape(s.get("title", ""))
            room = html_mod.escape(s.get("room", ""))
            stype = s.get("type", "")
            start = html_mod.escape(s.get("start_time", ""))
            end = html_mod.escape(s.get("end_time", ""))
            sched_url = s.get("sched_url", "")
            speakers = s.get("speakers", [])
            is_keynote = stype == "keynote"
            time_str = f"{start}–{end}" if start and end else start

            # Title — linked to Sched if available
            if sched_url:
                title_html = (
                    f'<a href="#" onclick="window._app&&window._app.openLink(&quot;{sched_url}&quot;);'
                    f'return false" class="schedule-title link">{title}</a>'
                )
            else:
                title_html = f'<span class="schedule-title">{title}</span>'

            # Meta line: badge + time + room
            meta_parts = []
            if stype:
                meta_parts.append(
                    f'<span class="badge badge-{stype}">{html_mod.escape(stype.replace("_", " "))}</span>'
                )
            if time_str:
                meta_parts.append(f'<span class="sess-time-r">{time_str}</span>')
            if room:
                meta_parts.append(f'<span class="schedule-room">{room}</span>')
            meta_html = (
                '<div class="schedule-meta">' + "".join(meta_parts) + "</div>" if meta_parts else ""
            )

            # Speakers
            speakers_html = ""
            if speakers and stype in ("keynote", "talk", "workshop"):
                names = ", ".join(html_mod.escape(str(n)) for n in speakers)
                speakers_html = f'<div class="schedule-speakers">{names}</div>'

            h += (
                f'<div class="schedule-item" data-keynote="{str(is_keynote).lower()}">'
                f"{title_html}{meta_html}{speakers_html}</div>"
            )
    return h


_UNUSED_SPEAKER_WIDGET_HTML = """\
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  padding:16px;background:var(--color-background-primary,#fff);
  color:var(--color-text-primary,#1a1a1a)}
.loading{text-align:center;padding:20px;opacity:0.5;font-size:13px}
.card{max-width:420px;margin-bottom:16px}
.header{display:flex;gap:12px;margin-bottom:10px}
.photo{width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0}
.initial{width:52px;height:52px;border-radius:50%;background:#6366f122;
  display:flex;align-items:center;justify-content:center;font-size:18px;color:#6366f1;flex-shrink:0}
.name{font-size:15px;font-weight:600}
.role{font-size:12px;opacity:0.6;margin-top:2px}
.bio{font-size:12px;line-height:1.5;opacity:0.65;margin:10px 0}
.tags{display:flex;flex-wrap:wrap;gap:3px;margin:6px 0}
.tag{display:inline-block;padding:1px 6px;border-radius:3px;background:#6366f112;
  color:#6366f1;font-size:10px;border:1px solid #6366f128}
.label{font-size:9px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.4;margin:10px 0 3px}
.sess{font-size:12px;opacity:0.55;padding:2px 0}
.link{color:#6366f1;text-decoration:none;font-size:12px;display:inline-block;margin-top:6px}
</style></head><body>
<div id="root"><div class="loading">Loading...</div></div>
<script>
(function(){
  var root = document.getElementById("root");

  // Use ext-apps protocol to open links (sandbox blocks direct navigation)
  window.openLink = function(url) {
    window.parent.postMessage({jsonrpc:"2.0", id:"link-"+Date.now(),
      method:"ui/open-link", params:{url:url}}, "*");
  };

  function render(speakers) {
    if (!speakers || !speakers.length) { root.innerHTML = '<div class="loading">No results</div>'; return; }
    var h = "";
    speakers.forEach(function(sp) {
      var photo = sp.photo_url
        ? '<img src="'+sp.photo_url+'" class="photo" alt="">'
        : '<div class="initial">'+(sp.name||"?").charAt(0)+'</div>';
      var bio = sp.bio ? '<div class="bio">'+(sp.bio.length>250?sp.bio.substring(0,250)+"...":sp.bio)+'</div>' : "";
      var tags = (sp.topics||[]).map(function(t){return '<span class="tag">'+t+'</span>';}).join("");
      var sess = (sp.sessions||[]).map(function(s){
        return '<div class="sess">'+(s.day||"").slice(5)+' '+(s.start_time||"")+' — '+(s.title||"")+'</div>';
      }).join("");
      var li = sp.linkedin_url ? '<a href="#" onclick="openLink(\''+sp.linkedin_url+'\');return false;" class="link">LinkedIn ↗</a>' : "";
      h += '<div class="card"><div class="header">'+photo+'<div>'
        +'<div class="name">'+sp.name+'</div>'
        +'<div class="role">'+(sp.role?sp.role+", ":"")+(sp.company||"")+'</div>'
        +'</div></div>'+bio+(tags?'<div class="tags">'+tags+'</div>':"")
        +(sess?'<div class="label">Sessions</div>'+sess:"")+li+'</div>';
    });
    root.innerHTML = h;
    // Tell host our size
    try { window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/size-changed",
      params:{width:root.scrollWidth,height:root.scrollHeight+32}}, "*"); } catch(e){}
  }

  window.addEventListener("message", function(e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;

    if (m.id === "__init") {
      window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}}, "*");
      var ctx = (m.result||{}).hostContext || {};
      if (ctx.styles && ctx.styles.variables) {
        var v = ctx.styles.variables;
        for (var k in v) if (v[k]) document.documentElement.style.setProperty(k, v[k]);
      }
      resize();
    }

    // Step 6: Host sends tool-input with arguments
    if (m.method === "ui/notifications/tool-input") {
      // We could use these to show what was searched
    }

    // Step 8: Host sends tool-result with the actual data
    if (m.method === "ui/notifications/tool-result") {
      var result = m.params || {};
      // Try structuredContent first, fall back to parsing content text
      var data = result.structuredContent;
      if (!data && result.content) {
        try {
          var txt = result.content.map(function(c){return c.text||"";}).join("");
          data = JSON.parse(txt);
        } catch(ex){}
      }
      if (data && data.results) {
        render(data.results);
      } else {
        root.innerHTML = '<div class="loading">No speaker data in result</div>';
      }
    }

    // Theme changes
    if (m.method === "ui/notifications/host-context-changed") {
      var p = m.params || {};
      if (p.styles && p.styles.variables) {
        var vars = p.styles.variables;
        for (var key in vars) if (vars[key]) document.documentElement.style.setProperty(key, vars[key]);
      }
    }
  });

  resize();
  window.parent.postMessage({jsonrpc:"2.0", id:"__init", method:"ui/initialize", params:{
    protocolVersion: "2026-01-26",
    capabilities: {},
    clientInfo: {name:"mcp-dev-summit-speaker", version:"1.0.0"}
  }}, "*");
})();
</script>
</body></html>
"""

SESSION_WIDGET_HTML = """\
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  padding:16px;background:var(--color-background-primary,#fff);
  color:var(--color-text-primary,#1a1a1a)}
.loading{text-align:center;padding:20px;opacity:0.5;font-size:13px}
.meta{font-size:11px;opacity:0.5;margin-bottom:12px}
.session{border:1px solid var(--color-border-primary,#e5e7eb);border-radius:8px;padding:12px;margin-bottom:8px}
.session:hover{border-color:#6366f1}
.title{font-size:14px;font-weight:600;margin-bottom:4px}
.info{font-size:12px;opacity:0.6;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;text-transform:uppercase;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.badge-keynote{background:#eab30822;color:#eab308}
.badge-talk{background:#6366f122;color:#6366f1}
.badge-workshop{background:#22c55e22;color:#22c55e}
.badge-sponsor_activity{background:#f9731622;color:#f97316}
.badge-sponsor_activity{background:#f9731622;color:#f97316}
.speakers{font-size:12px;opacity:0.55}
.desc{font-size:12px;line-height:1.5;opacity:0.6;margin-top:6px}
</style></head><body>
<div id="root"><div class="loading">Loading...</div></div>
<script>
(function(){
  var root = document.getElementById("root");
  function render(data) {
    var results = data.results || [];
    if (!results.length) { root.innerHTML = '<div class="loading">No sessions found</div>'; return; }
    var h = '<div class="meta">'+data.total+' sessions found</div>';
    results.forEach(function(s) {
      var type = s.session_type || "";
      var badge = '<span class="badge badge-'+type+'">'+type+'</span>';
      var speakers = (s.speakers||[]).map(function(sp){return sp.name||"";}).join(", ")
        || (s.speaker_names||[]).join(", ");
      var desc = s.description_preview ? '<div class="desc">'+s.description_preview+'</div>' : "";
      h += '<div class="session">'+badge
        +' <span class="title">'+s.title+'</span>'
        +'<div class="info"><span>'+(s.day||"").slice(5)+' '+(s.start_time||"")+'-'+(s.end_time||"")+'</span>'
        +'<span>'+(s.room||"")+'</span></div>'
        +(speakers?'<div class="speakers">'+speakers+'</div>':"")
        +desc+'</div>';
    });
    root.innerHTML = h;
  }
  Synapse.connect({name:'mcp-dev-summit-sessions',version:'1.0.0',autoResize:true}).then(function(syn){
    syn.on('tool-result',function(result){
      var parsed = result.content != null ? result.content : result;
      if(parsed)render(parsed);
    });
  });
})();
</script>
</body></html>
"""

SCHEDULE_WIDGET_HTML = """\
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  padding:16px;background:var(--color-background-primary,#fff);
  color:var(--color-text-primary,#1a1a1a)}
.loading{text-align:center;padding:20px;opacity:0.5;font-size:13px}
.label{font-size:14px;font-weight:600;margin-bottom:12px}
.time{font-size:12px;font-weight:600;color:#6366f1;margin:10px 0 4px;padding-bottom:4px;border-bottom:1px solid #e5e7eb22}
.item{font-size:12px;padding:4px 0;display:flex;gap:8px}
.item-title{flex:1}
.item-room{opacity:0.4;font-size:11px;white-space:nowrap}
.item-type{font-size:9px;text-transform:uppercase;opacity:0.5}
</style></head><body>
<div id="root"><div class="loading">Loading...</div></div>
<script>
(function(){
  var root = document.getElementById("root");
  function render(data) {
    var slots = data.time_slots || [];
    if (!slots.length) { root.innerHTML = '<div class="loading">No sessions</div>'; return; }
    var h = '<div class="label">'+(data.label||data.day||"Schedule")+'</div>';
    slots.forEach(function(slot) {
      h += '<div class="time">'+slot.time+'</div>';
      (slot.sessions||[]).forEach(function(s) {
        h += '<div class="item"><span class="item-type">'+(s.type||"")+'</span>'
          +'<span class="item-title">'+s.title+'</span>'
          +'<span class="item-room">'+(s.room||"")+'</span></div>';
      });
    });
    root.innerHTML = h;
  }
  Synapse.connect({name:'mcp-dev-summit-schedule',version:'1.0.0',autoResize:true}).then(function(syn){
    syn.on('tool-result',function(result){
      var parsed = result.content != null ? result.content : result;
      if(parsed)render(parsed);
    });
  });
})();
</script>
</body></html>
"""

# =============================================================================
# Photo inlining — convert speaker photo_url to base64 data URIs
# so ext-apps iframes don't need CSP exceptions for external images.
# =============================================================================

_PHOTOS_DIR = MANIFEST.parent / "seed" / "photos"
_THUMBS_DIR = MANIFEST.parent / "seed" / "thumbs"


def _inline_photos(speakers: list[dict], max_speakers: int = 5, use_thumbs: bool = False) -> None:
    """Replace photo_url with base64 data URI for up to max_speakers."""
    import base64

    photo_dir = _THUMBS_DIR if use_thumbs else _PHOTOS_DIR
    for sp in speakers[:max_speakers]:
        sp_id = sp.get("id", "")
        if not sp_id:
            continue
        photo_path = photo_dir / f"{sp_id}.jpg"
        if photo_path.exists():
            data = photo_path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            sp["photo_url"] = f"data:image/jpeg;base64,{b64}"


# =============================================================================
# Lightweight HTML widgets (for inline rendering in Claude Desktop, ChatGPT, etc.)
# These are self-contained — no Synapse, no bridge, data baked in.
# =============================================================================


def _render_speaker_card(sp: dict) -> str:
    """Render a speaker card div (no document wrapper)."""
    import html as html_mod

    name = html_mod.escape(sp.get("name", ""))
    photo = sp.get("photo_url", "")
    role = html_mod.escape(sp.get("role", ""))
    company = html_mod.escape(sp.get("company", ""))
    bio = html_mod.escape(sp.get("bio", "")[:300])
    if len(sp.get("bio", "")) > 300:
        bio += "..."
    topics = sp.get("topics", [])
    linkedin = sp.get("linkedin_url", "")
    sessions = sp.get("sessions", [])

    topics_html = " ".join(f'<span class="tag">{html_mod.escape(t)}</span>' for t in topics)
    sessions_html = "".join(
        f'<div class="sess">{html_mod.escape(s.get("day", "")[-5:])} '
        f"{html_mod.escape(s.get('start_time', ''))} — {html_mod.escape(s.get('title', ''))}</div>"
        for s in sessions
    )
    photo_html = (
        f'<img src="{photo}" class="photo" alt="{name}">'
        if photo
        else f'<div class="initial">{name[0] if name else "?"}</div>'
    )
    linkedin_html = (
        f'<a href="{linkedin}" target="_blank" class="link">LinkedIn ↗</a>' if linkedin else ""
    )

    return (
        f'<div class="card"><div class="header">{photo_html}<div>'
        f'<div class="name">{name}</div>'
        f'<div class="role">{(role + ", ") if role else ""}{company}</div>'
        f"</div></div>"
        f"{f'<div class=bio>{bio}</div>' if bio else ''}"
        f"{f'<div class=tags>{topics_html}</div>' if topics else ''}"
        f"{f'<div class=label>Sessions</div>{sessions_html}' if sessions_html else ''}"
        f"{linkedin_html}</div>"
    )


# =============================================================================
# Health endpoint
# =============================================================================


@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request) -> JSONResponse:
    """Health check endpoint for monitoring."""
    return JSONResponse({"status": "healthy", "service": "mcp-dev-summit", "mode": MODE})


# =============================================================================
# Custom tools — aggregation, time-aware, planning, reports
# These go beyond what auto-CRUD provides.
# =============================================================================

from .tools.schedule import get_day_schedule as _get_day_schedule  # noqa: E402
from .tools.schedule import whats_on as _whats_on  # noqa: E402
from .tools.search import browse_sponsors as _browse_sponsors  # noqa: E402
from .tools.search import find_speakers as _find_speakers  # noqa: E402
from .tools.search import search_sessions as _search_sessions  # noqa: E402


@mcp.tool(
    meta={"ui": {"resourceUri": "ui://mcp-dev-summit/session-widget"}},
)
def find_sessions(
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
    """Find conference sessions with rich filtering — by topic, speaker, company, track, time range. Returns results with speaker details inlined. Day accepts natural names (thursday, fri), dates (april 2, 4/2), or ISO (2026-04-02)."""
    result = _search_sessions(
        upjack_app,
        query=query,
        day=day,
        track=track,
        session_type=session_type,
        start_after=start_after,
        start_before=start_before,
        speaker=speaker,
        company=company,
        limit=limit,
    )
    _last_widget_data["sessions"] = result.get("results", [])[:10]
    return result


@mcp.tool()
def get_day_schedule(day: str, track: str = "") -> dict:
    """Get the complete schedule for a conference day, grouped by time slot. Day accepts natural names (thursday, fri), dates (april 2, 4/2), or ISO (2026-04-02)."""
    result = _get_day_schedule(upjack_app, day=day, track=track)
    _last_widget_data["schedule"] = result
    return result


@mcp.tool()
def whats_on(include_next: int = 2, track: str = "") -> dict:
    """Time-aware view of what's happening now and next at the conference (Eastern Time)."""
    return _whats_on(upjack_app, include_next=include_next, track=track)


@mcp.tool(
    meta={"ui": {"resourceUri": "ui://mcp-dev-summit/speaker-widget"}},
)
def find_speaker_profiles(
    query: str = "",
    company: str = "",
    is_keynote: bool = False,
    limit: int = 20,
) -> dict:
    """Find speakers with their sessions inlined. Filter by name, company, topic, or keynote status. Returns speaker cards with photos, bios, and session links."""
    result = _find_speakers(
        upjack_app, query=query, company=company, is_keynote=is_keynote, limit=limit
    )
    _inline_photos(result.get("results", []), max_speakers=5, use_thumbs=True)
    return result


@mcp.tool()
def browse_sponsors(tier: str = "", query: str = "") -> dict:
    """Browse conference sponsors by tier. Returns booth activities and sponsored sessions."""
    return _browse_sponsors(upjack_app, tier=tier, query=query)


@mcp.tool()
def bookmark_session(
    session_id: str,
    priority: str = "want_to_attend",
    notes: str = "",
) -> dict:
    """Bookmark a session for your personal schedule. Creates a bookmark entity linked to the session via a `bookmarks` relationship. Priority: must_attend, want_to_attend, maybe."""
    if priority not in ("must_attend", "want_to_attend", "maybe"):
        priority = "want_to_attend"
    data: dict[str, Any] = {
        "priority": priority,
        "relationships": [{"rel": "bookmarks", "target": session_id}],
    }
    if notes:
        data["notes"] = notes
    return upjack_app.create_entity("bookmark", data)


# =============================================================================
# Local-only custom tools (planning & reports)
# =============================================================================

if MODE == "local":
    from .tools.planner import check_conflicts as _check_conflicts  # noqa: E402
    from .tools.planner import my_schedule as _my_schedule  # noqa: E402
    from .tools.report import daily_briefing as _daily_briefing  # noqa: E402
    from .tools.report import post_conference_report as _post_conference_report  # noqa: E402

    @mcp.tool()
    def my_schedule(day: str = "") -> dict:
        """Build a personal timeline from bookmarks for a conference day. Shows conflicts, room transitions, and gaps."""
        return _my_schedule(upjack_app, day=day)

    @mcp.tool()
    def check_conflicts(bookmark_id: str = "") -> dict:
        """Check for time conflicts between bookmarked sessions."""
        return _check_conflicts(upjack_app, bookmark_id=bookmark_id)

    @mcp.tool()
    def daily_briefing(day: str = "") -> dict:
        """Morning briefing: today's sessions, yesterday's action items, follow-ups due, evening events."""
        return _daily_briefing(upjack_app, day=day)

    @mcp.tool()
    def post_conference_report(format: str = "summary") -> dict:
        """Generate a post-conference report. Formats: summary, detailed, team_share."""
        return _post_conference_report(upjack_app, format=format)

    logger.info("Local mode: Upjack CRUD + 9 custom tools")
else:
    logger.info("Hosted mode: Upjack CRUD + 5 custom tools")


# ASGI app for HTTP deployment (uvicorn references mcp_dev_summit.server:app)
app = mcp.http_app()

# Stdio entrypoint for mpak / Claude Desktop
if __name__ == "__main__":
    logger.info("Running in stdio mode")
    mcp.run()
