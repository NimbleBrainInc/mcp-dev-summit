import { useCallback, useEffect, useRef, useState } from "react";
import {
  SynapseProvider,
  useCallTool,
  useDataSync,
  useSynapse,
} from "@nimblebrain/synapse/react";

/* ---------- types ---------- */

interface Session {
  id: string;
  title: string;
  session_type: string;
  track: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  speakers: { name: string; company: string }[];
  speaker_names?: string[];
  speaker_companies?: string[];
  description?: string;
  description_preview?: string;
  sched_url?: string;
  requires_registration?: boolean;
  bookmarked?: boolean;
}

interface TimeSlot {
  time: string;
  sessions: Session[];
}

interface Relationship {
  rel: string;
  target: string;
  label?: string;
}

interface BookmarkEntity {
  id: string;
  priority: string;
  notes?: string;
  relationships: Relationship[];
}

interface Speaker {
  id: string;
  name: string;
  company: string;
  role: string;
  bio: string;
  photo_url: string;
  topics: string[];
  is_keynote: boolean;
  sessions: { id: string; title: string; day: string; start_time: string }[];
}

/* ---------- tabs ---------- */

type Tab = "schedule" | "bookmarks" | "speakers" | "search";

const DAYS = [
  { value: "2026-04-01", label: "Wed Apr 1" },
  { value: "2026-04-02", label: "Thu Apr 2" },
  { value: "2026-04-03", label: "Fri Apr 3" },
];

/* ---------- CSS ---------- */

const SUMMIT_CSS = `
.summit-container {
  background: var(--color-background-primary, #0f172a);
  color: var(--color-text-primary, #e2e8f0);
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  min-height: 100vh;
  padding: 0.75rem;
}
.summit-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 0.75rem;
  background: var(--color-background-secondary, #1e293b);
  border-radius: var(--border-radius-sm, 0.5rem);
  padding: 3px;
}
.summit-tab {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: var(--border-radius-sm, 0.5rem);
  background: transparent;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 0.8rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s;
}
.summit-tab--active {
  background: var(--color-text-accent, #818cf8);
  color: var(--nb-color-accent-foreground, #ffffff);
  font-weight: 600;
}
.summit-day-picker {
  display: flex;
  gap: 4px;
  margin-bottom: 0.75rem;
}
.summit-day-btn {
  flex: 1;
  padding: 0.4rem;
  border: 1px solid var(--color-border-primary, #334155);
  border-radius: var(--border-radius-sm, 0.5rem);
  background: transparent;
  color: var(--color-text-primary, #e2e8f0);
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 400;
}
.summit-day-btn--active {
  border-color: var(--color-text-accent, #818cf8);
  background: var(--color-text-accent, #818cf8);
  color: var(--nb-color-accent-foreground, #ffffff);
  font-weight: 600;
}
.summit-card {
  background: var(--color-background-secondary, #1e293b);
  border: 1px solid var(--color-border-primary, #334155);
  border-radius: var(--border-radius-sm, 0.5rem);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
.summit-card--clickable {
  cursor: pointer;
  transition: border-color 0.15s;
}
.summit-card--clickable:hover {
  border-color: var(--color-text-accent, #818cf8);
}
.summit-session-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary, #e2e8f0);
  margin-bottom: 2px;
}
.summit-session-meta {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #94a3b8);
}
.summit-time-slot-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-accent, #818cf8);
  padding: 0.5rem 0 0.25rem;
  border-bottom: 1px solid var(--color-border-primary, #334155);
  margin-bottom: 0.5rem;
}
.summit-bookmark-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 2px 4px;
  color: var(--color-text-secondary, #94a3b8);
  opacity: 0.5;
  transition: all 0.15s;
}
.summit-bookmark-btn--active {
  color: #eab308;
  opacity: 1;
}
.summit-input {
  flex: 1;
  padding: 0.5rem 0.6rem;
  border-radius: var(--border-radius-sm, 0.5rem);
  border: 1px solid var(--color-border-primary, #334155);
  background: var(--color-background-secondary, #1e293b);
  color: var(--color-text-primary, #e2e8f0);
  font-size: 0.85rem;
  outline: none;
}
.summit-btn {
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius-sm, 0.5rem);
  border: none;
  background: var(--color-text-accent, #818cf8);
  color: var(--nb-color-accent-foreground, #ffffff);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}
.summit-btn--outline {
  background: transparent;
  border: 1px solid var(--color-border-primary, #334155);
  color: var(--color-text-primary, #e2e8f0);
}
.summit-btn--unbookmark {
  background: transparent;
  border: 1px solid var(--color-border-primary, #334155);
  color: var(--color-text-secondary, #94a3b8);
}
.summit-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 4px;
  background: #64748b22;
  color: #64748b;
}
.summit-badge--keynote { background: #eab30822; color: #eab308; }
.summit-badge--talk { background: #6366f122; color: #6366f1; }
.summit-badge--workshop { background: #22c55e22; color: #22c55e; }
.summit-badge--break { background: #64748b22; color: #64748b; }
.summit-badge--social { background: #ec489922; color: #ec4899; }
.summit-badge--sponsor_activity { background: #f9731622; color: #f97316; }
.summit-badge--track {
  background: color-mix(in srgb, var(--color-text-accent, #818cf8) 13%, transparent);
  color: var(--color-text-accent, #818cf8);
}
.summit-priority-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
  margin-right: 6px;
}
.summit-priority-dot--must { background: #ef4444; }
.summit-priority-dot--want { background: #eab308; }
.summit-empty {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 0.85rem;
}
.summit-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.summit-modal {
  background: var(--color-background-secondary, #1e293b);
  border: 1px solid var(--color-border-primary, #334155);
  border-radius: 12px 12px 0 0;
  padding: 1.25rem;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--color-text-primary, #e2e8f0);
}
.summit-modal-close {
  background: none;
  border: none;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}
.summit-label {
  color: var(--color-text-secondary, #94a3b8);
  font-size: 0.7rem;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.summit-speaker-photo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.summit-speaker-photo--lg {
  width: 48px;
  height: 48px;
}
.summit-speaker-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-text-accent, #818cf8) 20%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-text-accent, #818cf8);
  flex-shrink: 0;
}
.summit-speaker-avatar--lg {
  width: 48px;
  height: 48px;
  font-size: 1.1rem;
}
.summit-topic-tag {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--color-text-accent, #818cf8) 8%, transparent);
  color: var(--color-text-accent, #818cf8);
  border: 1px solid color-mix(in srgb, var(--color-text-accent, #818cf8) 20%, transparent);
}
.summit-link {
  color: var(--color-text-accent, #818cf8);
  font-size: 0.7rem;
  text-decoration: none;
  cursor: pointer;
}
.summit-link:visited,
.summit-link:active {
  color: var(--color-text-accent, #818cf8);
}
.summit-border-top {
  border-top: 1px solid var(--color-border-primary, #334155);
}
.summit-border-bottom {
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-primary, #334155) 13%, transparent);
}
.summit-muted {
  color: var(--color-text-secondary, #94a3b8);
}
.summit-accent {
  color: var(--color-text-accent, #818cf8);
}
`;

/* ---------- helpers ---------- */

function getSessionIdFromBookmark(bk: BookmarkEntity): string | null {
  const rel = bk.relationships?.find((r) => r.rel === "bookmarks");
  return rel?.target ?? null;
}

function parseToolResult(raw: unknown): unknown {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.content)) {
      const text = (obj.content as Array<{ text?: string }>)
        .map((c) => c.text || "")
        .join("");
      try { return JSON.parse(text); } catch { return text; }
    }
    return obj;
  }
  return raw;
}

function asDict(raw: unknown): Record<string, unknown> {
  const parsed = parseToolResult(raw);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function asList(raw: unknown): unknown[] {
  const parsed = parseToolResult(raw);
  if (Array.isArray(parsed)) return parsed;
  // Upjack list tools return { entities: [...] } or just an array
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.entities)) return obj.entities;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.bookmarks)) return obj.bookmarks;
  }
  return [];
}

/* ---------- badge class helper ---------- */

function badgeClass(type: string): string {
  const known = ["keynote", "talk", "workshop", "break", "social", "sponsor_activity"];
  if (known.includes(type)) return `summit-badge summit-badge--${type}`;
  return "summit-badge";
}

function priorityDotClass(p: string): string {
  if (p === "must_attend") return "summit-priority-dot summit-priority-dot--must";
  if (p === "want_to_attend") return "summit-priority-dot summit-priority-dot--want";
  return "summit-priority-dot";
}

/* ---------- main app ---------- */

function SummitUI() {
  const synapse = useSynapse();

  const [tab, setTab] = useState<Tab>("schedule");
  const [day, setDay] = useState("2026-04-02");
  const [searchQuery, setSearchQuery] = useState("");
  const [speakerQuery, setSpeakerQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<"all" | "keynote">("all");
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);

  // Tool hooks — custom tools (our format)
  const scheduleTool = useCallTool<string>("get_day_schedule");
  const searchTool = useCallTool<string>("find_sessions");
  const speakersTool = useCallTool<string>("find_speaker_profiles");

  // Tool hooks — Upjack auto-generated (entity format)
  const listBookmarksTool = useCallTool<string>("list_bookmarks");
  const createBookmarkTool = useCallTool<string>("create_bookmark");
  const deleteBookmarkTool = useCallTool<string>("delete_bookmark");
  const getSessionTool = useCallTool<string>("get_session");

  // State
  const [schedule, setSchedule] = useState<TimeSlot[]>([]);
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkEntity[]>([]);
  const [bookmarkSessions, setBookmarkSessions] = useState<Map<string, Session>>(new Map());
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [bookmarkedSessionIds, setBookmarkedSessionIds] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSpeakers, setDetailSpeakers] = useState<Speaker[]>([]);

  const getRelatedTool = useCallTool<string>("get_related_session");
  const getSpeakerTool = useCallTool<string>("get_speaker");

  async function openSessionDetail(session: Session) {
    setSelectedSession(session);
    setDetailSpeakers([]);
    setDetailLoading(true);

    try {
      // Fetch full session if we don't have description
      let full = session;
      if (!session.description) {
        const result = await getSessionTool.call({ session_id: session.id });
        const fetched = asDict(result.data) as unknown as Session;
        if (fetched?.id) {
          full = fetched;
          setSelectedSession(fetched);
        }
      }

      // Fetch speakers via relationships
      const rels = (full as Record<string, unknown>).relationships as Relationship[] | undefined;
      const speakerTargets = (rels || []).filter(r => r.rel === "presented_by").map(r => r.target);

      if (speakerTargets.length > 0) {
        const fetched: Speaker[] = [];
        for (const sid of speakerTargets) {
          try {
            const r = await getSpeakerTool.call({ speaker_id: sid });
            const sp = asDict(r.data) as unknown as Speaker;
            if (sp?.name) fetched.push(sp);
          } catch { /* */ }
        }
        setDetailSpeakers(fetched);
      }
    } catch { /* keep partial */ }
    setDetailLoading(false);
  }

  const loadSchedule = useCallback(async () => {
    try {
      const result = await scheduleTool.call({ day });
      const data = asDict(result.data);
      setSchedule((data.time_slots as TimeSlot[]) || []);
      setScheduleLabel((data.label as string) || "");
    } catch { /* */ }
  }, [day]);

  const loadBookmarks = useCallback(async () => {
    try {
      const result = await listBookmarksTool.call({});
      const parsed = asDict(result.data);
      const items = (parsed.entities as BookmarkEntity[]) || asList(result.data) as BookmarkEntity[];
      setBookmarks(items);

      const sessionIds = new Set<string>();
      for (const bk of items) {
        const sessionId = getSessionIdFromBookmark(bk);
        if (sessionId) sessionIds.add(sessionId);
      }
      setBookmarkedSessionIds(sessionIds);

      // Fetch session details in parallel
      const sessionMap = new Map<string, Session>();
      const fetches = Array.from(sessionIds).map(async (sid) => {
        try {
          const sResult = await getSessionTool.call({ session_id: sid });
          const session = asDict(sResult.data) as unknown as Session;
          if (session?.id) sessionMap.set(sid, session);
        } catch { /* */ }
      });
      await Promise.all(fetches);
      setBookmarkSessions(sessionMap);
    } catch { /* */ }
  }, []);

  const loadSpeakers = useCallback(async () => {
    try {
      const args: Record<string, unknown> = { limit: 200 };
      if (speakerQuery.trim()) args.query = speakerQuery;
      if (speakerFilter === "keynote") args.is_keynote = true;
      const result = await speakersTool.call(args);
      const data = asDict(result.data);
      setSpeakers((data.results as Speaker[]) || []);
    } catch { /* */ }
  }, [speakerQuery, speakerFilter]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);
  const [searching, setSearching] = useState(false);

  // Debounced auto-search on query change
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearching(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const seq = ++searchSeqRef.current;
      setSearching(true);
      try {
        const result = await searchTool.call({ query: searchQuery, limit: 30 });
        if (seq !== searchSeqRef.current) return; // stale — newer search in flight
        const data = asDict(result.data);
        setSearchResults((data.results as Session[]) || []);
        setSearchTotal((data.total as number) || 0);
      } catch (e) {
        if (seq !== searchSeqRef.current) return;
        console.error("[summit] search error:", e);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 600);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  async function toggleBookmark(sessionId: string) {
    if (bookmarkedSessionIds.has(sessionId)) {
      const bk = bookmarks.find((b) => getSessionIdFromBookmark(b) === sessionId);
      if (bk) {
        try { await deleteBookmarkTool.call({ bookmark_id: bk.id }); } catch { /* */ }
      }
    } else {
      try {
        await createBookmarkTool.call({
          data: {
            priority: "want_to_attend",
            relationships: [{ rel: "bookmarks", target: sessionId }],
          },
        });
      } catch { /* */ }
    }
    await loadBookmarks();
  }

  // Load data on mount and tab change
  useEffect(() => { loadSchedule(); }, [day, loadSchedule]);
  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);
  const speakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakerSeqRef = useRef(0);
  useEffect(() => {
    if (tab !== "speakers") return;
    if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
    speakerTimerRef.current = setTimeout(async () => {
      const seq = ++speakerSeqRef.current;
      try {
        const args: Record<string, unknown> = { limit: 200 };
        if (speakerQuery.trim()) args.query = speakerQuery;
        if (speakerFilter === "keynote") args.is_keynote = true;
        const result = await speakersTool.call(args);
        if (seq !== speakerSeqRef.current) return;
        const data = asDict(result.data);
        setSpeakers((data.results as Speaker[]) || []);
      } catch { /* */ }
    }, 600);
    return () => { if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current); };
  }, [tab, speakerQuery, speakerFilter]);

  // Refresh on agent data changes
  useDataSync(() => {
    loadSchedule();
    loadBookmarks();
  });

  /* ---------- session card ---------- */

  function SessionCard({ session, compact }: { session: Session; compact?: boolean }) {
    const isBookmarked = bookmarkedSessionIds.has(session.id);
    const speakerNames = session.speakers?.map((sp) => sp.name) || session.speaker_names || [];
    // Schedule tool returns "type", search tool returns "session_type"
    const sessionType = session.session_type || (session as Record<string, unknown>).type as string || "";
    const isClickable = ["talk", "keynote", "workshop", "sponsor_activity"].includes(sessionType);
    return (
      <div
        className={`summit-card ${isClickable ? "summit-card--clickable" : ""}`}
        style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
        onClick={() => isClickable && openSessionDetail({ ...session, session_type: sessionType })}
      >
        <button
          className={`summit-bookmark-btn ${isBookmarked ? "summit-bookmark-btn--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleBookmark(session.id); }}
          title={isBookmarked ? "Remove bookmark" : "Bookmark session"}
        >
          {isBookmarked ? "\u2605" : "\u2606"}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="summit-session-title">{session.title}</div>
          <div className="summit-session-meta">
            <span className={badgeClass(sessionType)}>{sessionType}</span>
            {session.room && <span>{session.room}</span>}
            {session.start_time && <span> &middot; {session.start_time}-{session.end_time}</span>}
          </div>
          {!compact && speakerNames.length > 0 && (
            <div className="summit-session-meta" style={{ marginTop: "3px" }}>
              {speakerNames.join(", ")}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- session detail modal ---------- */

  function SessionDetailModal() {
    if (!selectedSession) return null;
    const sess = selectedSession;
    const isBookmarked = bookmarkedSessionIds.has(sess.id);
    const speakerNames = sess.speakers?.map((sp) => sp.name) || sess.speaker_names || [];
    const speakerCompanies = sess.speakers?.map((sp) => sp.company) || sess.speaker_companies || [];
    const dayLabel = DAYS.find((d) => d.value === sess.day)?.label || sess.day;

    return (
      <div
        className="summit-modal-overlay"
        onClick={() => setSelectedSession(null)}
      >
        <div
          className="summit-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className={badgeClass(sess.session_type)}>{sess.session_type}</span>
                {sess.track && sess.track !== "keynote" && sess.track !== "special_events" && (
                  <span className="summit-badge summit-badge--track">
                    {sess.track.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.3, margin: 0 }}>{sess.title}</h2>
            </div>
            <button
              className="summit-modal-close"
              onClick={() => setSelectedSession(null)}
            >
              &times;
            </button>
          </div>

          {/* Time & location */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
            <div>
              <div className="summit-label">When</div>
              <div>{dayLabel} &middot; {sess.start_time}-{sess.end_time}</div>
            </div>
            {sess.room && (
              <div>
                <div className="summit-label">Where</div>
                <div>{sess.room}</div>
              </div>
            )}
          </div>

          {/* Speakers */}
          {(detailSpeakers.length > 0 || speakerNames.length > 0) && (
            <div style={{ marginBottom: "1rem" }}>
              <div className="summit-label" style={{ marginBottom: "8px" }}>Speakers</div>
              {detailSpeakers.length > 0 ? (
                detailSpeakers.map((sp) => (
                  <div key={sp.id} className="summit-border-bottom" style={{
                    display: "flex", gap: "0.75rem", padding: "0.5rem 0",
                  }}>
                    {sp.photo_url ? (
                      <img src={sp.photo_url} alt={sp.name} className="summit-speaker-photo" />
                    ) : (
                      <div className="summit-speaker-avatar">{sp.name.charAt(0)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>{sp.name}</span>
                        {(sp as Record<string, unknown>).linkedin_url && (
                          <a
                            href="#"
                            className="summit-link"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); synapse.openLink((sp as Record<string, unknown>).linkedin_url as string); }}
                          >LinkedIn</a>
                        )}
                      </div>
                      <div className="summit-session-meta">
                        {sp.role ? `${sp.role}, ` : ""}{sp.company}
                      </div>
                      {sp.bio && (
                        <div className="summit-muted" style={{ fontSize: "0.75rem", marginTop: "4px", lineHeight: 1.4 }}>
                          {sp.bio.length > 200 ? sp.bio.substring(0, 200) + "..." : sp.bio}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                speakerNames.map((name, i) => (
                  <div key={i} style={{ fontSize: "0.85rem", padding: "2px 0" }}>
                    <span style={{ fontWeight: 500 }}>{name}</span>
                    {speakerCompanies[i] && <span className="summit-muted"> &middot; {speakerCompanies[i]}</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Description */}
          {detailLoading ? (
            <div className="summit-muted" style={{ fontSize: "0.85rem" }}>Loading details...</div>
          ) : sess.description ? (
            <div style={{ marginBottom: "1rem" }}>
              <div className="summit-label" style={{ marginBottom: "4px" }}>About</div>
              <div style={{ fontSize: "0.85rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {sess.description}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="summit-border-top" style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", paddingTop: "1rem" }}>
            <button
              className={`summit-btn ${isBookmarked ? "summit-btn--unbookmark" : ""}`}
              style={{ flex: 1 }}
              onClick={() => toggleBookmark(sess.id)}
            >
              {isBookmarked ? "Remove Bookmark" : "Bookmark Session"}
            </button>
            {sess.sched_url && (
              <button
                className="summit-btn summit-btn--outline"
                onClick={() => sess.sched_url && window.parent.postMessage(
                  { jsonrpc: "2.0", id: "lnk", method: "ui/open-link", params: { url: sess.sched_url } }, "*"
                )}
              >
                Sched &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- schedule view ---------- */

  function ScheduleView() {
    return (
      <>
        <div className="summit-day-picker">
          {DAYS.map((d) => (
            <button key={d.value} className={`summit-day-btn ${day === d.value ? "summit-day-btn--active" : ""}`} onClick={() => setDay(d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        {scheduleLabel && (
          <div className="summit-muted" style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>{scheduleLabel}</div>
        )}
        {scheduleTool.isPending ? (
          <div className="summit-empty">Loading schedule...</div>
        ) : schedule.length === 0 ? (
          <div className="summit-empty">No sessions found for this day.</div>
        ) : (
          schedule.map((slot) => (
            <div key={slot.time}>
              <div className="summit-time-slot-header">{slot.time}</div>
              {slot.sessions.map((sess) => (
                <SessionCard key={sess.id} session={sess} compact />
              ))}
            </div>
          ))
        )}
      </>
    );
  }

  /* ---------- bookmarks view ---------- */

  function BookmarksView() {
    const enriched = bookmarks.map((bk) => {
      const sessionId = getSessionIdFromBookmark(bk);
      const session = sessionId ? bookmarkSessions.get(sessionId) : null;
      return { bk, session, sessionId };
    });

    // Group by day if session details available, otherwise show flat list
    const withDay = enriched.filter((e) => e.session?.day);
    const withoutDay = enriched.filter((e) => !e.session?.day);

    const byDay = DAYS.map((d) => ({
      ...d,
      items: withDay.filter((e) => e.session!.day === d.value),
    })).filter((d) => d.items.length > 0);

    const renderBookmark = ({ bk, session, sessionId }: typeof enriched[0]) => (
      <div key={bk.id} className="summit-card" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          className="summit-bookmark-btn summit-bookmark-btn--active"
          onClick={() => sessionId && toggleBookmark(sessionId)}
          title="Remove bookmark"
        >
          {"\u2605"}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className={priorityDotClass(bk.priority || "want_to_attend")} />
            <span className="summit-session-title">{session?.title || sessionId || "Bookmarked session"}</span>
          </div>
          {session && (
            <div className="summit-session-meta">
              {session.start_time}-{session.end_time} &middot; {session.room}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <>
        {listBookmarksTool.isPending ? (
          <div className="summit-empty">Loading bookmarks...</div>
        ) : bookmarks.length === 0 ? (
          <div className="summit-empty">
            No sessions bookmarked yet.<br />
            Use the schedule tab to bookmark sessions.
          </div>
        ) : (
          <>
            {byDay.map((d) => (
              <div key={d.value}>
                <div className="summit-time-slot-header">{d.label}</div>
                {d.items.map(renderBookmark)}
              </div>
            ))}
            {withoutDay.length > 0 && (
              <div>
                {byDay.length > 0 && <div className="summit-time-slot-header">Other</div>}
                {withoutDay.map(renderBookmark)}
              </div>
            )}
          </>
        )}
      </>
    );
  }

  /* ---------- speakers view ---------- */

  function SpeakersView() {
    const isExpanded = (id: string) => expandedSpeaker === id;

    return (
      <>
        {/* Search + filter */}
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            className="summit-input"
            style={{ width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.9rem", marginBottom: "0.5rem" }}
            type="text"
            placeholder="Search speakers..."
            value={speakerQuery}
            onChange={(e) => setSpeakerQuery(e.target.value)}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              className={`summit-day-btn ${speakerFilter === "all" ? "summit-day-btn--active" : ""}`}
              onClick={() => setSpeakerFilter("all")}
            >All Speakers</button>
            <button
              className={`summit-day-btn ${speakerFilter === "keynote" ? "summit-day-btn--active" : ""}`}
              onClick={() => setSpeakerFilter("keynote")}
            >Keynotes Only</button>
          </div>
        </div>

        {speakersTool.isPending ? (
          <div className="summit-empty">Loading speakers...</div>
        ) : speakers.length === 0 ? (
          <div className="summit-empty">No speakers found.</div>
        ) : (
          <>
            <div className="summit-muted" style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}>
              {speakers.length} speakers
            </div>
            {speakers.map((sp) => (
              <div
                key={sp.id}
                className="summit-card summit-card--clickable"
                onClick={() => setExpandedSpeaker(isExpanded(sp.id) ? null : sp.id)}
              >
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {/* Photo */}
                  {sp.photo_url ? (
                    <img
                      src={sp.photo_url}
                      alt={sp.name}
                      className="summit-speaker-photo summit-speaker-photo--lg"
                    />
                  ) : (
                    <div className="summit-speaker-avatar summit-speaker-avatar--lg">
                      {sp.name.charAt(0)}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span className="summit-session-title" style={{ fontSize: "0.9rem" }}>{sp.name}</span>
                      {sp.is_keynote && <span className={badgeClass("keynote")}>keynote</span>}
                      {(sp as Record<string, unknown>).linkedin_url && (
                        <a
                          href={(sp as Record<string, unknown>).linkedin_url as string}
                          target="_blank"
                          rel="noopener"
                          className="summit-link"
                          onClick={(e) => e.stopPropagation()}
                        >LinkedIn</a>
                      )}
                    </div>
                    <div className="summit-session-meta">
                      {sp.role ? `${sp.role}, ` : ""}{sp.company}
                    </div>

                    {/* Topics */}
                    {sp.topics && sp.topics.length > 0 && (
                      <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
                        {sp.topics.map((topic, i) => (
                          <span key={i} className="summit-topic-tag">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded: bio + sessions */}
                {isExpanded(sp.id) && (
                  <div className="summit-border-top" style={{ marginTop: "0.75rem", paddingTop: "0.75rem" }}>
                    {sp.bio && (
                      <div className="summit-muted" style={{ fontSize: "0.8rem", lineHeight: 1.5, marginBottom: "0.75rem" }}>
                        {sp.bio}
                      </div>
                    )}
                    {sp.sessions && sp.sessions.length > 0 && (
                      <div>
                        <div className="summit-label" style={{ marginBottom: "4px" }}>Sessions</div>
                        {sp.sessions.map((sess) => (
                          <div key={sess.id} className="summit-session-meta" style={{ padding: "3px 0", fontSize: "0.8rem" }}>
                            {DAYS.find(d => d.value === sess.day)?.label || sess.day} {sess.start_time} &mdash; {sess.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  /* ---------- search view ---------- */

  function SearchView() {
    return (
      <>
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            className="summit-input"
            style={{ width: "100%", padding: "0.6rem 0.75rem", fontSize: "0.9rem" }}
            type="text"
            placeholder="Search sessions, speakers, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        {searching && (
          <div className="summit-empty">Searching...</div>
        )}
        {!searching && searchQuery.trim() && searchTotal > 0 && (
          <div className="summit-muted" style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            {searchTotal} results
          </div>
        )}
        {!searching && searchQuery.trim() && searchTotal === 0 && searchResults.length === 0 && (
          <div className="summit-empty">No sessions found for "{searchQuery}"</div>
        )}
        {!searchQuery.trim() && (
          <div className="summit-empty">Type to search across sessions, speakers, and topics</div>
        )}
        {searchResults.map((sess) => (
          <SessionCard key={sess.id} session={sess} />
        ))}
      </>
    );
  }

  /* ---------- render ---------- */

  return (
    <>
      <style>{SUMMIT_CSS}</style>
      <div className="summit-container">
        <div className="summit-tabs">
          <button className={`summit-tab ${tab === "schedule" ? "summit-tab--active" : ""}`} onClick={() => setTab("schedule")}>Schedule</button>
          <button className={`summit-tab ${tab === "bookmarks" ? "summit-tab--active" : ""}`} onClick={() => setTab("bookmarks")}>
            Bookmarks{bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}
          </button>
          <button className={`summit-tab ${tab === "speakers" ? "summit-tab--active" : ""}`} onClick={() => setTab("speakers")}>Speakers</button>
          <button className={`summit-tab ${tab === "search" ? "summit-tab--active" : ""}`} onClick={() => setTab("search")}>Search</button>
        </div>

        {tab === "schedule" && ScheduleView()}
        {tab === "bookmarks" && BookmarksView()}
        {tab === "speakers" && SpeakersView()}
        {tab === "search" && SearchView()}

        {SessionDetailModal()}
      </div>
    </>
  );
}

export function App() {
  return (
    <SynapseProvider name="mcp-dev-summit" version="0.1.0">
      <SummitUI />
    </SynapseProvider>
  );
}
