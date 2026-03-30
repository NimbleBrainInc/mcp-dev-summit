import { useCallback, useEffect, useRef, useState } from "react";
import {
  SynapseProvider,
  useCallTool,
  useDataSync,
  useSynapse,
  useTheme,
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

/* ---------- main app ---------- */

function SummitUI() {
  const synapse = useSynapse();
  const theme = useTheme();
  const t = theme.tokens;

  // Use CSS var() so the host-injected tokens (set at parse time) always win.
  // JS fallbacks only matter if useTheme() tokens arrive late; match light mode.
  const bg = "var(--color-background-primary)";
  const fg = "var(--color-text-primary)";
  const card = "var(--color-background-secondary)";
  const cardFg = "var(--color-text-primary)";
  const primary = "var(--color-text-accent)";
  const primaryFg = "var(--nb-color-accent-foreground, #ffffff)";
  const muted = "var(--color-text-secondary)";
  const border = "var(--color-border-primary)";
  const radius = "var(--border-radius-sm, 0.5rem)";

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

  /* ---------- styles ---------- */

  const s = {
    container: {
      background: bg,
      color: fg,
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
      minHeight: "100vh",
      padding: "0.75rem",
    } as React.CSSProperties,
    tabs: {
      display: "flex",
      gap: "2px",
      marginBottom: "0.75rem",
      background: card,
      borderRadius: radius,
      padding: "3px",
    } as React.CSSProperties,
    tab: (active: boolean) => ({
      flex: 1,
      padding: "0.5rem",
      border: "none",
      borderRadius: radius,
      background: active ? primary : "transparent",
      color: active ? primaryFg : muted,
      fontSize: "0.8rem",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all 0.15s",
    }) as React.CSSProperties,
    dayPicker: {
      display: "flex",
      gap: "4px",
      marginBottom: "0.75rem",
    } as React.CSSProperties,
    dayBtn: (active: boolean) => ({
      flex: 1,
      padding: "0.4rem",
      border: `1px solid ${active ? primary : border}`,
      borderRadius: radius,
      background: active ? primary : "transparent",
      color: active ? primaryFg : fg,
      fontSize: "0.75rem",
      cursor: "pointer",
      fontWeight: active ? 600 : 400,
    }) as React.CSSProperties,
    card: {
      background: card,
      border: `1px solid ${border}`,
      borderRadius: radius,
      padding: "0.75rem",
      marginBottom: "0.5rem",
    } as React.CSSProperties,
    sessionTitle: {
      fontSize: "0.85rem",
      fontWeight: 500,
      color: cardFg,
      marginBottom: "2px",
    } as React.CSSProperties,
    sessionMeta: {
      fontSize: "0.7rem",
      color: muted,
    } as React.CSSProperties,
    timeSlotHeader: {
      fontSize: "0.75rem",
      fontWeight: 600,
      color: primary,
      padding: "0.5rem 0 0.25rem",
      borderBottom: `1px solid ${border}`,
      marginBottom: "0.5rem",
    } as React.CSSProperties,
    bookmarkBtn: (isBookmarked: boolean) => ({
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: "1.1rem",
      padding: "2px 4px",
      color: isBookmarked ? "#eab308" : muted,
      opacity: isBookmarked ? 1 : 0.5,
      transition: "all 0.15s",
    }) as React.CSSProperties,
    searchRow: {
      display: "flex",
      gap: "0.5rem",
      marginBottom: "0.75rem",
    } as React.CSSProperties,
    input: {
      flex: 1,
      padding: "0.5rem 0.6rem",
      borderRadius: radius,
      border: `1px solid ${border}`,
      background: card,
      color: fg,
      fontSize: "0.85rem",
      outline: "none",
    } as React.CSSProperties,
    btn: {
      padding: "0.5rem 1rem",
      borderRadius: radius,
      border: "none",
      background: primary,
      color: primaryFg,
      fontSize: "0.85rem",
      fontWeight: 500,
      cursor: "pointer",
    } as React.CSSProperties,
    badge: (type: string) => {
      const colors: Record<string, string> = {
        keynote: "#eab308",
        talk: "#6366f1",
        workshop: "#22c55e",
        break: "#64748b",
        social: "#ec4899",
        sponsor_activity: "#f97316",
      };
      return {
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "3px",
        fontSize: "0.6rem",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        background: (colors[type] || "#64748b") + "22",
        color: colors[type] || "#64748b",
        marginRight: "4px",
      };
    },
    priorityDot: (p: string) => {
      const c = p === "must_attend" ? "#ef4444" : p === "want_to_attend" ? "#eab308" : "#64748b";
      return {
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: c,
        marginRight: 6,
      } as React.CSSProperties;
    },
    empty: {
      textAlign: "center" as const,
      padding: "2rem",
      color: muted,
      fontSize: "0.85rem",
    },
  };

  /* ---------- session card ---------- */

  function SessionCard({ session, compact }: { session: Session; compact?: boolean }) {
    const isBookmarked = bookmarkedSessionIds.has(session.id);
    const speakerNames = session.speakers?.map((sp) => sp.name) || session.speaker_names || [];
    // Schedule tool returns "type", search tool returns "session_type"
    const sessionType = session.session_type || (session as Record<string, unknown>).type as string || "";
    const isClickable = ["talk", "keynote", "workshop", "sponsor_activity"].includes(sessionType);
    return (
      <div
        style={{
          ...s.card,
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          cursor: isClickable ? "pointer" : "default",
          transition: "border-color 0.15s",
        }}
        onClick={() => isClickable && openSessionDetail({ ...session, session_type: sessionType })}
        onMouseEnter={(e) => { if (isClickable) (e.currentTarget as HTMLDivElement).style.borderColor = primary; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = border; }}
      >
        <button
          style={s.bookmarkBtn(isBookmarked)}
          onClick={(e) => { e.stopPropagation(); toggleBookmark(session.id); }}
          title={isBookmarked ? "Remove bookmark" : "Bookmark session"}
        >
          {isBookmarked ? "\u2605" : "\u2606"}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.sessionTitle}>{session.title}</div>
          <div style={s.sessionMeta}>
            <span style={s.badge(sessionType)}>{sessionType}</span>
            {session.room && <span>{session.room}</span>}
            {session.start_time && <span> &middot; {session.start_time}-{session.end_time}</span>}
          </div>
          {!compact && speakerNames.length > 0 && (
            <div style={{ ...s.sessionMeta, marginTop: "3px" }}>
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
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem",
        }}
        onClick={() => setSelectedSession(null)}
      >
        <div
          style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: "12px 12px 0 0",
            padding: "1.25rem",
            width: "100%",
            maxWidth: 600,
            maxHeight: "80vh",
            overflowY: "auto",
            color: cardFg,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={s.badge(sess.session_type)}>{sess.session_type}</span>
                {sess.track && sess.track !== "keynote" && sess.track !== "special_events" && (
                  <span style={{ ...s.badge(sess.track), background: `${primary}22`, color: primary }}>
                    {sess.track.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.3, margin: 0 }}>{sess.title}</h2>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              style={{
                background: "none",
                border: "none",
                color: muted,
                fontSize: "1.5rem",
                cursor: "pointer",
                padding: "0 0.25rem",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {/* Time & location */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
            <div>
              <div style={{ color: muted, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>When</div>
              <div>{dayLabel} &middot; {sess.start_time}-{sess.end_time}</div>
            </div>
            {sess.room && (
              <div>
                <div style={{ color: muted, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>Where</div>
                <div>{sess.room}</div>
              </div>
            )}
          </div>

          {/* Speakers */}
          {(detailSpeakers.length > 0 || speakerNames.length > 0) && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: muted, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "8px" }}>Speakers</div>
              {detailSpeakers.length > 0 ? (
                detailSpeakers.map((sp) => (
                  <div key={sp.id} style={{
                    display: "flex", gap: "0.75rem", padding: "0.5rem 0",
                    borderBottom: `1px solid ${border}22`,
                  }}>
                    {sp.photo_url ? (
                      <img src={sp.photo_url} alt={sp.name} style={{
                        width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
                      }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%", background: `${primary}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem", color: primary, flexShrink: 0,
                      }}>{sp.name.charAt(0)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>{sp.name}</span>
                        {(sp as Record<string, unknown>).linkedin_url && (
                          <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); synapse.openLink((sp as Record<string, unknown>).linkedin_url as string); }}
                            style={{ color: primary, fontSize: "0.7rem", textDecoration: "none", cursor: "pointer" }}
                          >LinkedIn</a>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: muted }}>
                        {sp.role ? `${sp.role}, ` : ""}{sp.company}
                      </div>
                      {sp.bio && (
                        <div style={{ fontSize: "0.75rem", color: muted, marginTop: "4px", lineHeight: 1.4 }}>
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
                    {speakerCompanies[i] && <span style={{ color: muted }}> &middot; {speakerCompanies[i]}</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Description */}
          {detailLoading ? (
            <div style={{ color: muted, fontSize: "0.85rem" }}>Loading details...</div>
          ) : sess.description ? (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: muted, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "4px" }}>About</div>
              <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: cardFg, whiteSpace: "pre-wrap" }}>
                {sess.description}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${border}` }}>
            <button
              style={{
                ...s.btn,
                flex: 1,
                background: isBookmarked ? "transparent" : primary,
                color: isBookmarked ? muted : primaryFg,
                border: isBookmarked ? `1px solid ${border}` : "none",
              }}
              onClick={() => toggleBookmark(sess.id)}
            >
              {isBookmarked ? "Remove Bookmark" : "Bookmark Session"}
            </button>
            {sess.sched_url && (
              <button
                style={{ ...s.btn, background: "transparent", border: `1px solid ${border}`, color: fg }}
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
        <div style={s.dayPicker}>
          {DAYS.map((d) => (
            <button key={d.value} style={s.dayBtn(day === d.value)} onClick={() => setDay(d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        {scheduleLabel && (
          <div style={{ fontSize: "0.8rem", color: muted, marginBottom: "0.5rem" }}>{scheduleLabel}</div>
        )}
        {scheduleTool.isPending ? (
          <div style={s.empty}>Loading schedule...</div>
        ) : schedule.length === 0 ? (
          <div style={s.empty}>No sessions found for this day.</div>
        ) : (
          schedule.map((slot) => (
            <div key={slot.time}>
              <div style={s.timeSlotHeader}>{slot.time}</div>
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
      <div key={bk.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          style={s.bookmarkBtn(true)}
          onClick={() => sessionId && toggleBookmark(sessionId)}
          title="Remove bookmark"
        >
          {"\u2605"}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={s.priorityDot(bk.priority || "want_to_attend")} />
            <span style={s.sessionTitle}>{session?.title || sessionId || "Bookmarked session"}</span>
          </div>
          {session && (
            <div style={s.sessionMeta}>
              {session.start_time}-{session.end_time} &middot; {session.room}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <>
        {listBookmarksTool.isPending ? (
          <div style={s.empty}>Loading bookmarks...</div>
        ) : bookmarks.length === 0 ? (
          <div style={s.empty}>
            No sessions bookmarked yet.<br />
            Use the schedule tab to bookmark sessions.
          </div>
        ) : (
          <>
            {byDay.map((d) => (
              <div key={d.value}>
                <div style={s.timeSlotHeader}>{d.label}</div>
                {d.items.map(renderBookmark)}
              </div>
            ))}
            {withoutDay.length > 0 && (
              <div>
                {byDay.length > 0 && <div style={s.timeSlotHeader}>Other</div>}
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
            style={{ ...s.input, width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.9rem", marginBottom: "0.5rem" }}
            type="text"
            placeholder="Search speakers..."
            value={speakerQuery}
            onChange={(e) => setSpeakerQuery(e.target.value)}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              style={s.dayBtn(speakerFilter === "all")}
              onClick={() => setSpeakerFilter("all")}
            >All Speakers</button>
            <button
              style={s.dayBtn(speakerFilter === "keynote")}
              onClick={() => setSpeakerFilter("keynote")}
            >Keynotes Only</button>
          </div>
        </div>

        {speakersTool.isPending ? (
          <div style={s.empty}>Loading speakers...</div>
        ) : speakers.length === 0 ? (
          <div style={s.empty}>No speakers found.</div>
        ) : (
          <>
            <div style={{ fontSize: "0.75rem", color: muted, marginBottom: "0.5rem" }}>
              {speakers.length} speakers
            </div>
            {speakers.map((sp) => (
              <div
                key={sp.id}
                style={{ ...s.card, cursor: "pointer", transition: "border-color 0.15s" }}
                onClick={() => setExpandedSpeaker(isExpanded(sp.id) ? null : sp.id)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = border)}
              >
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {/* Photo */}
                  {sp.photo_url ? (
                    <img
                      src={sp.photo_url}
                      alt={sp.name}
                      style={{
                        width: 48, height: 48, borderRadius: "50%",
                        objectFit: "cover", flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: `${primary}33`, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: "1.1rem", color: primary, flexShrink: 0,
                    }}>
                      {sp.name.charAt(0)}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ ...s.sessionTitle, fontSize: "0.9rem" }}>{sp.name}</span>
                      {sp.is_keynote && <span style={s.badge("keynote")}>keynote</span>}
                      {(sp as Record<string, unknown>).linkedin_url && (
                        <a
                          href={(sp as Record<string, unknown>).linkedin_url as string}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: primary, fontSize: "0.7rem", textDecoration: "none" }}
                        >LinkedIn</a>
                      )}
                    </div>
                    <div style={s.sessionMeta}>
                      {sp.role ? `${sp.role}, ` : ""}{sp.company}
                    </div>

                    {/* Topics */}
                    {sp.topics && sp.topics.length > 0 && (
                      <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
                        {sp.topics.map((topic, i) => (
                          <span key={i} style={{
                            fontSize: "0.6rem", padding: "1px 5px", borderRadius: "3px",
                            background: `${primary}15`, color: primary, border: `1px solid ${primary}33`,
                          }}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded: bio + sessions */}
                {isExpanded(sp.id) && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${border}` }}>
                    {sp.bio && (
                      <div style={{ fontSize: "0.8rem", lineHeight: 1.5, color: muted, marginBottom: "0.75rem" }}>
                        {sp.bio}
                      </div>
                    )}
                    {sp.sessions && sp.sessions.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.7rem", color: muted, textTransform: "uppercase", marginBottom: "4px" }}>Sessions</div>
                        {sp.sessions.map((sess) => (
                          <div key={sess.id} style={{ ...s.sessionMeta, padding: "3px 0", fontSize: "0.8rem" }}>
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
            style={{ ...s.input, width: "100%", padding: "0.6rem 0.75rem", fontSize: "0.9rem" }}
            type="text"
            placeholder="Search sessions, speakers, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        {searching && (
          <div style={s.empty}>Searching...</div>
        )}
        {!searching && searchQuery.trim() && searchTotal > 0 && (
          <div style={{ fontSize: "0.75rem", color: muted, marginBottom: "0.5rem" }}>
            {searchTotal} results
          </div>
        )}
        {!searching && searchQuery.trim() && searchTotal === 0 && searchResults.length === 0 && (
          <div style={s.empty}>No sessions found for "{searchQuery}"</div>
        )}
        {!searchQuery.trim() && (
          <div style={s.empty}>Type to search across sessions, speakers, and topics</div>
        )}
        {searchResults.map((sess) => (
          <SessionCard key={sess.id} session={sess} />
        ))}
      </>
    );
  }

  /* ---------- render ---------- */

  return (
    <div style={s.container}>
      <div style={s.tabs}>
        <button style={s.tab(tab === "schedule")} onClick={() => setTab("schedule")}>Schedule</button>
        <button style={s.tab(tab === "bookmarks")} onClick={() => setTab("bookmarks")}>
          Bookmarks{bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}
        </button>
        <button style={s.tab(tab === "speakers")} onClick={() => setTab("speakers")}>Speakers</button>
        <button style={s.tab(tab === "search")} onClick={() => setTab("search")}>Search</button>
      </div>

      {tab === "schedule" && ScheduleView()}
      {tab === "bookmarks" && BookmarksView()}
      {tab === "speakers" && SpeakersView()}
      {tab === "search" && SearchView()}

      {SessionDetailModal()}
    </div>
  );
}

export function App() {
  return (
    <SynapseProvider name="mcp-dev-summit" version="0.1.0">
      <SummitUI />
    </SynapseProvider>
  );
}
