import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SynapseProvider,
  useCallTool,
  useDataSync,
  useSynapse,
  useTheme,
} from "@nimblebrain/synapse/react";
import { SUMMIT_CSS } from "./styles";

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
  linkedin_url?: string;
}

type Tab = "schedule" | "bookmarks" | "speakers" | "search";

const DAYS = [
  { value: "2026-04-01", short: "Wed", date: "Apr 1" },
  { value: "2026-04-02", short: "Thu", date: "Apr 2" },
  { value: "2026-04-03", short: "Fri", date: "Apr 3" },
];

const SEARCH_SUGGESTIONS = ["agents", "authentication", "OpenAI", "evals", "tool use"];

const BREAK_TYPES = new Set(["break"]);
const CLICKABLE_TYPES = new Set(["talk", "keynote", "workshop", "sponsor_activity"]);

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
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.entities)) return obj.entities;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.bookmarks)) return obj.bookmarks;
  }
  return [];
}

function badgeClass(type: string): string {
  const known = ["keynote", "workshop", "social", "sponsor_activity"];
  if (known.includes(type)) return `summit-badge summit-badge--${type}`;
  return "summit-badge";
}

function priorityClass(p: string): string {
  if (p === "must_attend") return "summit-bk-row__priority summit-bk-row__priority--must";
  if (p === "want_to_attend") return "summit-bk-row__priority summit-bk-row__priority--want";
  return "summit-bk-row__priority";
}

function fmtTimeRange(start: string, end: string): string {
  if (!start) return "";
  if (!end) return start;
  return `${start}–${end}`;
}

/* ---------- icons ---------- */

const SearchIcon = () => (
  <svg className="summit-search__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="5" />
    <path d="m11 11 3 3" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
    <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
  </svg>
);

/* ---------- skeleton ---------- */

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="summit-skeleton-row">
          <div className="summit-skeleton-row__line summit-skeleton" style={{ width: `${50 + Math.random() * 40}%` }} />
          <div className="summit-skeleton-row__line summit-skeleton-row__line--short summit-skeleton" />
        </div>
      ))}
    </div>
  );
}

/* ---------- main ---------- */

function SummitUI() {
  const synapse = useSynapse();
  const theme = useTheme();

  // Apply theme mode to root element so the CSS palette responds.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
  }, [theme.mode]);

  const [tab, setTab] = useState<Tab>("schedule");
  const [day, setDay] = useState("2026-04-02");
  const [searchQuery, setSearchQuery] = useState("");
  const [speakerQuery, setSpeakerQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<"all" | "keynote">("all");
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);

  // Tools
  const scheduleTool = useCallTool<string>("get_day_schedule");
  const searchTool = useCallTool<string>("find_sessions");
  const speakersTool = useCallTool<string>("find_speaker_profiles");
  const listBookmarksTool = useCallTool<string>("list_bookmarks");
  const deleteBookmarkTool = useCallTool<string>("delete_bookmark");
  const getSessionTool = useCallTool<string>("get_session");
  const bookmarkSessionTool = useCallTool<string>("bookmark_session");
  const getSpeakerTool = useCallTool<string>("get_speaker");

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

  /* ---------- data fetching ---------- */

  const loadSchedule = useCallback(async () => {
    try {
      const result = await scheduleTool.call({ day });
      const data = asDict(result.data);
      setSchedule((data.time_slots as TimeSlot[]) || []);
      setScheduleLabel((data.label as string) || "");
    } catch { /* */ }
    // scheduleTool is intentionally not in deps — useCallTool returns a fresh
    // reference each render which would cause infinite loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- bookmark detail ---------- */

  async function openSessionDetail(session: Session) {
    setSelectedSession(session);
    setDetailSpeakers([]);
    setDetailLoading(true);
    try {
      let full = session;
      if (!session.description) {
        const result = await getSessionTool.call({ session_id: session.id });
        const fetched = asDict(result.data) as unknown as Session;
        if (fetched?.id) {
          full = fetched;
          setSelectedSession(fetched);
        }
      }
      const rels = (full as unknown as Record<string, unknown>).relationships as Relationship[] | undefined;
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
    } catch { /* */ }
    setDetailLoading(false);
  }

  /* ---------- search ---------- */

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);
  const [searching, setSearching] = useState(false);

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
        if (seq !== searchSeqRef.current) return;
        const data = asDict(result.data);
        setSearchResults((data.results as Session[]) || []);
        setSearchTotal((data.total as number) || 0);
      } catch (e) {
        if (seq !== searchSeqRef.current) return;
        console.error("[summit] search error:", e);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 250);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /* ---------- speakers debounced ---------- */

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
    }, 250);
    return () => { if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, speakerQuery, speakerFilter]);

  /* ---------- bookmarks: toggle ---------- */

  async function toggleBookmark(sessionId: string) {
    if (bookmarkedSessionIds.has(sessionId)) {
      const bk = bookmarks.find((b) => getSessionIdFromBookmark(b) === sessionId);
      if (bk) {
        try { await deleteBookmarkTool.call({ bookmark_id: bk.id }); } catch { /* */ }
      }
    } else {
      try {
        await bookmarkSessionTool.call({ session_id: sessionId });
      } catch { /* */ }
    }
    await loadBookmarks();
  }

  /* ---------- effects ---------- */

  useEffect(() => { loadSchedule(); }, [day, loadSchedule]);
  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);
  useDataSync(() => {
    loadSchedule();
    loadBookmarks();
  });

  /* ---------- escape closes modal ---------- */

  useEffect(() => {
    if (!selectedSession) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedSession(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSession]);

  /* ---------- session row ---------- */

  function SessionRow({ session }: { session: Session }) {
    const isBookmarked = bookmarkedSessionIds.has(session.id);
    const sessionType = session.session_type
      || ((session as unknown as Record<string, unknown>).type as string)
      || "";
    const isClickable = CLICKABLE_TYPES.has(sessionType);
    const isKeynote = sessionType === "keynote";
    const speakerNames = session.speakers?.map((sp) => sp.name) || session.speaker_names || [];

    return (
      <div
        className="summit-row"
        data-clickable={isClickable}
        data-bookmarked={isBookmarked && !isKeynote}
        data-keynote={isKeynote}
        onClick={() => isClickable && openSessionDetail({ ...session, session_type: sessionType })}
      >
        <button
          type="button"
          className="summit-bk"
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          title={isBookmarked ? "Remove bookmark" : "Bookmark this session"}
          onClick={(e) => { e.stopPropagation(); toggleBookmark(session.id); }}
        >
          {isBookmarked ? <CheckIcon /> : <PlusIcon />}
        </button>
        <div>
          <div className="summit-row__title">{session.title}</div>
          <div className="summit-row__meta">
            <span className={badgeClass(sessionType)}>{sessionType.replace(/_/g, " ")}</span>
            {session.room && <span className="summit-row__meta-room">{session.room}</span>}
            {session.start_time && (
              <span className="summit-row__meta-time">
                {fmtTimeRange(session.start_time, session.end_time)}
              </span>
            )}
          </div>
          {speakerNames.length > 0 && (
            <div className="summit-row__speakers">{speakerNames.join(", ")}</div>
          )}
        </div>
      </div>
    );
  }

  function BreakRow({ session }: { session: Session }) {
    return (
      <div className="summit-break">
        <span className="summit-break__time">
          {session.start_time ? fmtTimeRange(session.start_time, session.end_time) : ""}
        </span>
        <span>{session.title}</span>
        {session.room && <span style={{ color: "var(--summit-ink-3)" }}>· {session.room}</span>}
      </div>
    );
  }

  /* ---------- modal ---------- */

  function SessionDetailModal() {
    if (!selectedSession) return null;
    const sess = selectedSession;
    const isBookmarked = bookmarkedSessionIds.has(sess.id);
    const speakerNames = sess.speakers?.map((sp) => sp.name) || sess.speaker_names || [];
    const speakerCompanies = sess.speakers?.map((sp) => sp.company) || sess.speaker_companies || [];
    const dayInfo = DAYS.find((d) => d.value === sess.day);
    const dayLabel = dayInfo ? `${dayInfo.short} ${dayInfo.date}` : sess.day;

    return (
      <div className="summit-modal__overlay" onClick={() => setSelectedSession(null)}>
        <div className="summit-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="summit-modal__head">
            <div className="summit-modal__eyebrow">
              <span className={badgeClass(sess.session_type)}>{sess.session_type.replace(/_/g, " ")}</span>
              {sess.track && sess.track !== "keynote" && sess.track !== "special_events" && (
                <span className="summit-badge summit-badge--track">{sess.track.replace(/_/g, " ")}</span>
              )}
            </div>
            <h2 className="summit-modal__title">{sess.title}</h2>
            <button
              type="button"
              className="summit-modal__close"
              aria-label="Close"
              onClick={() => setSelectedSession(null)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="summit-modal__body">
            <div className="summit-modal__row">
              <div className="summit-modal__cell">
                <div className="summit-label">When</div>
                <div className="summit-modal__when">
                  {dayLabel} · {fmtTimeRange(sess.start_time, sess.end_time)}
                </div>
              </div>
              {sess.room && (
                <div className="summit-modal__cell">
                  <div className="summit-label">Where</div>
                  <div className="summit-modal__when">{sess.room}</div>
                </div>
              )}
            </div>

            {(detailSpeakers.length > 0 || speakerNames.length > 0) && (
              <div className="summit-modal__section">
                <div className="summit-label">Speakers</div>
                {detailSpeakers.length > 0 ? (
                  detailSpeakers.map((sp) => (
                    <div key={sp.id} className="summit-modal__speaker">
                      {sp.photo_url ? (
                        <img src={sp.photo_url} alt={sp.name} />
                      ) : (
                        <div className="summit-spk__initial">{sp.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="summit-modal__sp-name">
                          <span>{sp.name}</span>
                          {sp.linkedin_url && (
                            <a
                              href={sp.linkedin_url}
                              className="summit-link"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (sp.linkedin_url) synapse.openLink(sp.linkedin_url);
                              }}
                            >LinkedIn</a>
                          )}
                        </div>
                        <div className="summit-modal__sp-role">
                          {sp.role ? `${sp.role}, ` : ""}{sp.company}
                        </div>
                        {sp.bio && (
                          <div className="summit-modal__sp-bio">
                            {sp.bio.length > 220 ? sp.bio.substring(0, 220) + "…" : sp.bio}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  speakerNames.map((name, i) => (
                    <div key={i} className="summit-modal__sp-name" style={{ padding: "4px 0" }}>
                      {name}
                      {speakerCompanies[i] && (
                        <span style={{ fontWeight: 400, color: "var(--summit-ink-2)" }}>
                          {" "}· {speakerCompanies[i]}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {detailLoading ? (
              <div style={{ color: "var(--summit-ink-3)", fontSize: 13 }}>Loading details…</div>
            ) : sess.description ? (
              <div className="summit-modal__section">
                <div className="summit-label">About</div>
                <div className="summit-modal__desc">{sess.description}</div>
              </div>
            ) : null}
          </div>

          <div className="summit-modal__actions">
            <button
              type="button"
              className={isBookmarked ? "summit-btn summit-btn--unbookmark" : "summit-btn summit-btn--primary"}
              onClick={() => toggleBookmark(sess.id)}
            >
              {isBookmarked ? "Remove bookmark" : "Bookmark session"}
            </button>
            {sess.sched_url && (
              <button
                type="button"
                className="summit-btn summit-btn--ghost"
                onClick={() => sess.sched_url && synapse.openLink(sess.sched_url)}
              >Sched ↗</button>
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
        <div className="summit-days" role="tablist" aria-label="Conference day">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              className="summit-days__btn"
              aria-pressed={day === d.value}
              onClick={() => setDay(d.value)}
            >
              <span className="summit-days__btn--day">{d.short}</span>
              <span className="summit-days__btn--date">{d.date}</span>
            </button>
          ))}
        </div>
        {scheduleTool.isPending && schedule.length === 0 ? (
          <SkeletonRows count={6} />
        ) : schedule.length === 0 ? (
          <div className="summit-empty">
            <div className="summit-empty__icon">∅</div>
            <div className="summit-empty__title">No sessions</div>
            <div className="summit-empty__hint">Nothing on the schedule for this day yet.</div>
          </div>
        ) : (
          schedule.map((slot) => {
            const typeOf = (s: Session) => s.session_type || ((s as unknown as Record<string, unknown>).type as string) || "";
            const breaks = slot.sessions.filter((s) => BREAK_TYPES.has(typeOf(s)));
            const real = slot.sessions.filter((s) => !BREAK_TYPES.has(typeOf(s)));

            // If the slot is only breaks, render them as a single divider line.
            if (real.length === 0 && breaks.length > 0) {
              return (
                <div key={slot.time}>
                  {breaks.map((b) => <BreakRow key={b.id} session={b} />)}
                </div>
              );
            }

            return (
              <div key={slot.time} className="summit-slot">
                <div className="summit-slot__head">
                  <span className="summit-slot__time">{slot.time}</span>
                  <span className="summit-slot__rule" />
                  <span className="summit-slot__count">
                    {real.length} {real.length === 1 ? "session" : "sessions"}
                  </span>
                </div>
                {real.map((sess) => <SessionRow key={sess.id} session={sess} />)}
                {breaks.map((b) => <BreakRow key={b.id} session={b} />)}
              </div>
            );
          })
        )}
        {scheduleLabel && (
          <div style={{ fontSize: 11, color: "var(--summit-ink-3)", textAlign: "center", marginTop: 16 }}>
            {scheduleLabel}
          </div>
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

    const withDay = enriched.filter((e) => e.session?.day);
    const withoutDay = enriched.filter((e) => !e.session?.day);
    const byDay = DAYS.map((d) => ({
      ...d,
      items: withDay.filter((e) => e.session!.day === d.value),
    })).filter((d) => d.items.length > 0);

    const renderRow = ({ bk, session, sessionId }: typeof enriched[0]) => (
      <div
        key={bk.id}
        className="summit-bk-row"
        onClick={() => session && openSessionDetail(session)}
      >
        <div>
          <div className="summit-bk-row__title">
            <span className={priorityClass(bk.priority || "want_to_attend")} />
            {session?.title || sessionId || "(missing session)"}
          </div>
          {session && (
            <div className="summit-bk-row__meta">
              {session.start_time && fmtTimeRange(session.start_time, session.end_time)}
              {session.room && ` · ${session.room}`}
            </div>
          )}
        </div>
        <button
          type="button"
          className="summit-bk"
          aria-pressed
          aria-label="Remove bookmark"
          title="Remove bookmark"
          onClick={(e) => { e.stopPropagation(); sessionId && toggleBookmark(sessionId); }}
        >
          <CheckIcon />
        </button>
      </div>
    );

    if (listBookmarksTool.isPending && bookmarks.length === 0) {
      return <SkeletonRows count={4} />;
    }
    if (bookmarks.length === 0) {
      return (
        <div className="summit-empty">
          <div className="summit-empty__icon">★</div>
          <div className="summit-empty__title">No bookmarks yet</div>
          <div className="summit-empty__hint">
            Tap <span style={{ display: "inline-block", verticalAlign: "middle", margin: "0 2px" }}>
              <span className="summit-bk" style={{ width: 18, height: 18, display: "inline-flex" }}><PlusIcon /></span>
            </span> next to any session to save it here.
          </div>
        </div>
      );
    }

    return (
      <>
        {byDay.map((d) => (
          <div key={d.value}>
            <div className="summit-day-head">
              <span>{d.short} · {d.date}</span>
              <span className="summit-day-head__count">{d.items.length}</span>
            </div>
            {d.items.map(renderRow)}
          </div>
        ))}
        {withoutDay.length > 0 && (
          <div>
            {byDay.length > 0 && (
              <div className="summit-day-head">
                <span>Other</span>
                <span className="summit-day-head__count">{withoutDay.length}</span>
              </div>
            )}
            {withoutDay.map(renderRow)}
          </div>
        )}
      </>
    );
  }

  /* ---------- speakers view ---------- */

  function SpeakersView() {
    return (
      <>
        <div className="summit-search">
          <SearchIcon />
          <input
            className="summit-search__input"
            type="search"
            placeholder="Search speakers"
            value={speakerQuery}
            onChange={(e) => setSpeakerQuery(e.target.value)}
          />
          {speakerQuery && (
            <button type="button" className="summit-search__clear" onClick={() => setSpeakerQuery("")} aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="summit-filters">
          <button
            type="button"
            className="summit-filter"
            aria-pressed={speakerFilter === "all"}
            onClick={() => setSpeakerFilter("all")}
          >All</button>
          <button
            type="button"
            className="summit-filter"
            aria-pressed={speakerFilter === "keynote"}
            onClick={() => setSpeakerFilter("keynote")}
          >Keynotes</button>
        </div>

        {speakersTool.isPending && speakers.length === 0 ? (
          <SkeletonRows count={6} />
        ) : speakers.length === 0 ? (
          <div className="summit-empty">
            <div className="summit-empty__icon">⌖</div>
            <div className="summit-empty__title">No speakers found</div>
            <div className="summit-empty__hint">Try a different search or clear the filter.</div>
          </div>
        ) : (
          <>
            <div className="summit-speakers__count">{speakers.length} speakers</div>
            {speakers.map((sp) => (
              <div
                key={sp.id}
                className="summit-spk"
                onClick={() => setExpandedSpeaker(expandedSpeaker === sp.id ? null : sp.id)}
              >
                <div className="summit-spk__head">
                  {sp.photo_url ? (
                    <img className="summit-spk__avatar" src={sp.photo_url} alt={sp.name} />
                  ) : (
                    <div className="summit-spk__initial">{sp.name.charAt(0)}</div>
                  )}
                  <div>
                    <div className="summit-spk__name">
                      {sp.name}
                      {sp.is_keynote && <span className={badgeClass("keynote")}>keynote</span>}
                      {sp.linkedin_url && (
                        <a
                          href={sp.linkedin_url}
                          target="_blank"
                          rel="noopener"
                          className="summit-link"
                          onClick={(e) => e.stopPropagation()}
                        >LinkedIn</a>
                      )}
                    </div>
                    <div className="summit-spk__role">
                      {sp.role ? `${sp.role}, ` : ""}{sp.company}
                    </div>
                    {sp.topics && sp.topics.length > 0 && (
                      <div className="summit-spk__topics">
                        {sp.topics.slice(0, 4).map((t, i) => (
                          <span key={i} className="summit-spk__topic">{t}</span>
                        ))}
                        {sp.topics.length > 4 && (
                          <span className="summit-spk__topic" style={{ opacity: 0.6 }}>+{sp.topics.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {expandedSpeaker === sp.id && (
                  <div className="summit-spk__expand">
                    {sp.bio && <div className="summit-spk__bio">{sp.bio}</div>}
                    {sp.sessions && sp.sessions.length > 0 && (
                      <div>
                        <div className="summit-label" style={{ marginBottom: 6 }}>Sessions</div>
                        <div className="summit-spk__sess-list">
                          {sp.sessions.map((sess) => {
                            const dInfo = DAYS.find((d) => d.value === sess.day);
                            return (
                              <div key={sess.id} className="summit-spk__sess-item">
                                <span className="summit-spk__sess-time">
                                  {dInfo ? `${dInfo.short} ${sess.start_time}` : sess.start_time}
                                </span>
                                <span>{sess.title}</span>
                              </div>
                            );
                          })}
                        </div>
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
        <div className="summit-search">
          <SearchIcon />
          <input
            className="summit-search__input"
            type="search"
            placeholder="Search sessions, speakers, topics…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button type="button" className="summit-search__clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </div>

        {!searchQuery.trim() && (
          <>
            <div className="summit-suggestions">
              {SEARCH_SUGGESTIONS.map((q) => (
                <button key={q} type="button" className="summit-suggest" onClick={() => setSearchQuery(q)}>
                  {q}
                </button>
              ))}
            </div>
            <div className="summit-empty">
              <div className="summit-empty__icon">⌕</div>
              <div className="summit-empty__title">Search the conference</div>
              <div className="summit-empty__hint">Find sessions by topic, speaker, company, or keyword.</div>
            </div>
          </>
        )}

        {searching && (
          <SkeletonRows count={4} />
        )}
        {!searching && searchQuery.trim() && searchTotal > 0 && (
          <div className="summit-speakers__count">{searchTotal} results</div>
        )}
        {!searching && searchQuery.trim() && searchResults.length === 0 && (
          <div className="summit-empty">
            <div className="summit-empty__icon">∅</div>
            <div className="summit-empty__title">No matches for "{searchQuery}"</div>
            <div className="summit-empty__hint">Try a broader term or check spelling.</div>
          </div>
        )}
        {!searching && searchResults.map((sess) => <SessionRow key={sess.id} session={sess} />)}
      </>
    );
  }

  /* ---------- nav ---------- */

  const tabs: { key: Tab; label: string; count?: number }[] = useMemo(() => [
    { key: "schedule", label: "Schedule" },
    { key: "bookmarks", label: "Bookmarks", count: bookmarks.length },
    { key: "speakers", label: "Speakers" },
    { key: "search", label: "Search" },
  ], [bookmarks.length]);

  return (
    <>
      <style>{SUMMIT_CSS}</style>
      <div className="summit-root">
        <div className="summit-shell">
          <nav className="summit-nav" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className="summit-nav__tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="summit-nav__count">{t.count}</span>
                )}
              </button>
            ))}
          </nav>

          {tab === "schedule" && <ScheduleView />}
          {tab === "bookmarks" && <BookmarksView />}
          {tab === "speakers" && <SpeakersView />}
          {tab === "search" && <SearchView />}

          {SessionDetailModal()}
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <SynapseProvider name="mcp-dev-summit" version="0.6.0">
      <SummitUI />
    </SynapseProvider>
  );
}
