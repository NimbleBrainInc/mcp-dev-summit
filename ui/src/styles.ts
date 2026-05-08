/**
 * Visual system for the MCP Dev Summit companion.
 *
 * Self-contained palette: drives off `data-theme` on :root rather than
 * relying on host tokens to fill every variable. The host's
 * `--color-text-accent`, when present, overrides our accent fallback —
 * so the widget picks up brand color without breaking when other tokens
 * are missing or inconsistent.
 */
export const SUMMIT_CSS = `
:root[data-theme="light"] {
  --summit-surface: #ffffff;
  --summit-surface-2: #f8f9fb;
  --summit-surface-3: #eef0f4;
  --summit-ink: #0c111c;
  --summit-ink-2: #4a5468;
  --summit-ink-3: #8b95a8;
  --summit-rule: #e5e8ee;
  --summit-rule-soft: #eef0f4;
  --summit-accent: var(--color-text-accent, #4f46e5);
  --summit-accent-ink: #ffffff;
  --summit-accent-soft: color-mix(in srgb, var(--summit-accent) 10%, transparent);
  --summit-accent-line: color-mix(in srgb, var(--summit-accent) 28%, transparent);
  --summit-star: #c2820a;
  --summit-danger: #dc2626;
  --summit-success: #15803d;
  --summit-warning: #b45309;
  --summit-shadow: 0 1px 2px rgba(12, 17, 28, 0.04), 0 8px 24px rgba(12, 17, 28, 0.06);
}
:root[data-theme="dark"] {
  --summit-surface: #0b101a;
  --summit-surface-2: #131a28;
  --summit-surface-3: #1c2536;
  --summit-ink: #e7ecf3;
  --summit-ink-2: #98a3b8;
  --summit-ink-3: #5e6b82;
  --summit-rule: #1e2840;
  --summit-rule-soft: #161e2e;
  --summit-accent: var(--color-text-accent, #818cf8);
  --summit-accent-ink: #0b101a;
  --summit-accent-soft: color-mix(in srgb, var(--summit-accent) 14%, transparent);
  --summit-accent-line: color-mix(in srgb, var(--summit-accent) 35%, transparent);
  --summit-star: #facc15;
  --summit-danger: #f87171;
  --summit-success: #4ade80;
  --summit-warning: #f59e0b;
  --summit-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.4);
}

/* ---------- Reset within widget ---------- */
.summit-root,
.summit-root * {
  box-sizing: border-box;
}
.summit-root button {
  font: inherit;
}

/* ---------- Layout ---------- */
.summit-root {
  background: var(--summit-surface);
  color: var(--summit-ink);
  font-family: var(--font-sans, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter var", "Segoe UI", sans-serif);
  font-size: 13px;
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.summit-shell {
  padding: 14px 14px 32px;
  max-width: 720px;
  margin: 0 auto;
}

/* ---------- Tabs ---------- */
.summit-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--summit-rule);
  margin-bottom: 14px;
  position: sticky;
  top: 0;
  background: var(--summit-surface);
  z-index: 5;
}
.summit-nav__tab {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 4px;
  margin-right: 18px;
  color: var(--summit-ink-2);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: color 120ms, border-color 120ms;
}
.summit-nav__tab:hover { color: var(--summit-ink); }
.summit-nav__tab[aria-selected="true"] {
  color: var(--summit-ink);
  border-bottom-color: var(--summit-accent);
  font-weight: 600;
}
.summit-nav__count {
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
  color: var(--summit-ink-3);
  font-weight: 400;
}
.summit-nav__tab[aria-selected="true"] .summit-nav__count { color: var(--summit-accent); }

/* ---------- Day picker (segmented) ---------- */
.summit-days {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.summit-days__btn {
  flex: 1;
  appearance: none;
  border: 1px solid var(--summit-rule);
  background: var(--summit-surface);
  color: var(--summit-ink-2);
  padding: 9px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 120ms;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-variant-numeric: tabular-nums;
}
.summit-days__btn:hover {
  border-color: var(--summit-accent-line);
  color: var(--summit-ink);
}
.summit-days__btn[aria-pressed="true"] {
  background: var(--summit-accent-soft);
  color: var(--summit-accent);
  border-color: var(--summit-accent-line);
  box-shadow: inset 0 0 0 1px var(--summit-accent-line);
}
.summit-days__btn[aria-pressed="true"] .summit-days__btn--day { opacity: 0.8; }
.summit-days__btn--day { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.summit-days__btn--date { font-size: 13px; font-weight: 600; }

/* ---------- Time slot ---------- */
.summit-slot {
  margin-bottom: 18px;
}
.summit-slot__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 0 8px;
  border-bottom: 1px solid var(--summit-rule);
  margin-bottom: 4px;
}
.summit-slot__time {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--summit-ink);
  font-variant-numeric: tabular-nums;
}
.summit-slot__rule {
  flex: 1;
  height: 1px;
  background: transparent;
}
.summit-slot__count {
  font-size: 11px;
  color: var(--summit-ink-3);
  font-variant-numeric: tabular-nums;
}

/* ---------- Session row ---------- */
.summit-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--summit-rule-soft);
  cursor: default;
  position: relative;
}
.summit-row:last-child { border-bottom: none; }
.summit-row[data-clickable="true"] { cursor: pointer; }
.summit-row[data-clickable="true"]:hover { background: var(--summit-surface-2); margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
.summit-row[data-bookmarked="true"]::before {
  content: "";
  position: absolute;
  left: -14px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--summit-star);
}
.summit-row[data-keynote="true"]::before {
  content: "";
  position: absolute;
  left: -14px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--summit-accent);
}
.summit-row__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--summit-ink);
  line-height: 1.35;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.summit-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--summit-ink-2);
  align-items: baseline;
}
.summit-row__meta-time {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  color: var(--summit-ink-3);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.summit-row__meta-room { color: var(--summit-ink-2); }
.summit-row__speakers {
  font-size: 12px;
  color: var(--summit-ink-3);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- Bookmark button ---------- */
.summit-bk {
  appearance: none;
  background: transparent;
  border: 1px solid var(--summit-rule);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--summit-ink-3);
  transition: all 120ms;
  padding: 0;
  flex-shrink: 0;
  margin-top: 1px;
}
.summit-bk:hover {
  color: var(--summit-ink);
  border-color: var(--summit-ink-2);
}
.summit-bk[aria-pressed="true"] {
  background: var(--summit-star);
  border-color: var(--summit-star);
  color: #1a1306;
}
.summit-bk svg { width: 14px; height: 14px; }

/* ---------- Break row ---------- */
.summit-break {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  color: var(--summit-ink-3);
  font-size: 12px;
}
.summit-break::before {
  content: "";
  flex: 0 0 18px;
  height: 1px;
  background: var(--summit-rule);
}
.summit-break::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--summit-rule);
}
.summit-break__time {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: var(--summit-ink-2);
  font-weight: 500;
}

/* ---------- Badges ---------- */
.summit-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--summit-surface-3);
  color: var(--summit-ink-2);
}
.summit-badge--keynote { background: var(--summit-accent-soft); color: var(--summit-accent); }
.summit-badge--workshop { background: color-mix(in srgb, var(--summit-success) 14%, transparent); color: var(--summit-success); }
.summit-badge--social { background: color-mix(in srgb, #ec4899 14%, transparent); color: #ec4899; }
.summit-badge--sponsor_activity { background: color-mix(in srgb, var(--summit-warning) 14%, transparent); color: var(--summit-warning); }
.summit-badge--track {
  background: transparent;
  color: var(--summit-ink-3);
  border: 1px solid var(--summit-rule);
  font-weight: 500;
}

/* ---------- Search ---------- */
.summit-search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--summit-rule);
  border-radius: 10px;
  padding: 0 12px;
  background: var(--summit-surface);
  margin-bottom: 14px;
  transition: border-color 120ms, box-shadow 120ms;
}
.summit-search:focus-within {
  border-color: var(--summit-accent);
  box-shadow: 0 0 0 3px var(--summit-accent-soft);
}
.summit-search__icon {
  color: var(--summit-ink-3);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.summit-search__input {
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  outline: none;
  padding: 11px 0;
  font-size: 14px;
  color: var(--summit-ink);
  min-width: 0;
}
.summit-search__input::placeholder { color: var(--summit-ink-3); }
.summit-search__clear {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--summit-ink-3);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}
.summit-search__clear:hover { color: var(--summit-ink); }

.summit-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.summit-suggest {
  appearance: none;
  background: var(--summit-surface-2);
  border: 1px solid var(--summit-rule);
  color: var(--summit-ink-2);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 120ms;
}
.summit-suggest:hover {
  background: var(--summit-surface-3);
  color: var(--summit-ink);
  border-color: var(--summit-ink-3);
}

/* ---------- Filter pills (speakers) ---------- */
.summit-filters {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.summit-filter {
  appearance: none;
  border: 1px solid var(--summit-rule);
  background: transparent;
  color: var(--summit-ink-2);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 500;
}
.summit-filter[aria-pressed="true"] {
  background: var(--summit-accent-soft);
  color: var(--summit-accent);
  border-color: var(--summit-accent-line);
}

/* ---------- Speaker cards ---------- */
.summit-speakers__count {
  font-size: 11.5px;
  color: var(--summit-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.summit-spk {
  padding: 12px 0;
  border-bottom: 1px solid var(--summit-rule-soft);
  cursor: pointer;
}
.summit-spk:last-child { border-bottom: none; }
.summit-spk__head {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
  align-items: flex-start;
}
.summit-spk__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--summit-surface-3);
}
.summit-spk__initial {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--summit-accent-soft);
  color: var(--summit-accent);
  font-size: 16px;
  font-weight: 600;
}
.summit-spk__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--summit-ink);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.summit-spk__role {
  font-size: 12px;
  color: var(--summit-ink-2);
  margin-top: 2px;
}
.summit-spk__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.summit-spk__topic {
  font-size: 10.5px;
  color: var(--summit-ink-3);
  background: var(--summit-surface-2);
  padding: 1px 7px;
  border-radius: 3px;
}
.summit-spk__expand {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--summit-rule-soft);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--summit-ink-2);
}
.summit-spk__bio { margin-bottom: 10px; }
.summit-spk__sess-list { display: flex; flex-direction: column; gap: 3px; }
.summit-spk__sess-item {
  font-size: 12px;
  color: var(--summit-ink-2);
  display: flex;
  gap: 8px;
}
.summit-spk__sess-time {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  color: var(--summit-ink-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 86px;
}

/* ---------- Modal ---------- */
.summit-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 11, 18, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
  animation: summitFadeIn 140ms ease-out;
}
@keyframes summitFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes summitSlideIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.summit-modal {
  background: var(--summit-surface);
  border: 1px solid var(--summit-rule);
  border-radius: 14px;
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--summit-ink);
  box-shadow: var(--summit-shadow);
  animation: summitSlideIn 180ms ease-out;
}
.summit-modal__head {
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--summit-rule);
  position: sticky;
  top: 0;
  background: var(--summit-surface);
}
.summit-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: none;
  background: var(--summit-surface-2);
  color: var(--summit-ink-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.summit-modal__close:hover { background: var(--summit-surface-3); color: var(--summit-ink); }
.summit-modal__eyebrow {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.summit-modal__title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
  color: var(--summit-ink);
  padding-right: 32px;
}
.summit-modal__body { padding: 16px 20px; }
.summit-modal__row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.summit-modal__cell { flex: 0 0 auto; }
.summit-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--summit-ink-3);
  margin-bottom: 3px;
  font-weight: 600;
}
.summit-modal__when {
  font-size: 13px;
  color: var(--summit-ink);
  font-variant-numeric: tabular-nums;
}
.summit-modal__section { margin-bottom: 16px; }
.summit-modal__section:last-child { margin-bottom: 0; }
.summit-modal__desc {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--summit-ink);
  white-space: pre-wrap;
}
.summit-modal__speaker {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--summit-rule-soft);
}
.summit-modal__speaker:last-child { border-bottom: none; }
.summit-modal__speaker img,
.summit-modal__speaker .summit-spk__initial {
  width: 36px;
  height: 36px;
  font-size: 14px;
}
.summit-modal__sp-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--summit-ink);
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.summit-modal__sp-role {
  font-size: 12px;
  color: var(--summit-ink-2);
  margin-top: 1px;
}
.summit-modal__sp-bio {
  font-size: 12.5px;
  color: var(--summit-ink-2);
  margin-top: 6px;
  line-height: 1.5;
}
.summit-modal__actions {
  display: flex;
  gap: 8px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--summit-rule);
  position: sticky;
  bottom: 0;
  background: var(--summit-surface);
}
.summit-btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 120ms;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.summit-btn--primary {
  background: var(--summit-ink);
  color: var(--summit-surface);
  flex: 1;
}
.summit-btn--primary:hover { opacity: 0.9; }
.summit-btn--ghost {
  background: transparent;
  color: var(--summit-ink);
  border: 1px solid var(--summit-rule);
}
.summit-btn--ghost:hover { background: var(--summit-surface-2); }
.summit-btn--unbookmark {
  background: var(--summit-surface-2);
  color: var(--summit-ink);
  border: 1px solid var(--summit-rule);
  flex: 1;
}

/* ---------- Bookmark item ---------- */
.summit-bk-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--summit-rule-soft);
  cursor: pointer;
  align-items: center;
}
.summit-bk-row:last-child { border-bottom: none; }
.summit-bk-row:hover { background: var(--summit-surface-2); margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
.summit-bk-row__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--summit-ink);
  line-height: 1.35;
}
.summit-bk-row__meta {
  font-size: 12px;
  color: var(--summit-ink-3);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.summit-bk-row__priority {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--summit-ink-3);
  margin-right: 6px;
  vertical-align: middle;
}
.summit-bk-row__priority--must { background: var(--summit-danger); }
.summit-bk-row__priority--want { background: var(--summit-star); }

/* ---------- Empty / loading ---------- */
.summit-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--summit-ink-3);
}
.summit-empty__icon { font-size: 32px; opacity: 0.4; margin-bottom: 10px; line-height: 1; }
.summit-empty__title { font-size: 14px; font-weight: 600; color: var(--summit-ink-2); margin-bottom: 4px; }
.summit-empty__hint { font-size: 12.5px; line-height: 1.5; max-width: 280px; margin: 0 auto; }

.summit-skeleton {
  background: linear-gradient(90deg, var(--summit-surface-2) 0%, var(--summit-surface-3) 50%, var(--summit-surface-2) 100%);
  background-size: 200% 100%;
  animation: summitShimmer 1.4s linear infinite;
  border-radius: 4px;
}
.summit-skeleton-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--summit-rule-soft);
}
.summit-skeleton-row__line {
  height: 14px;
  background: var(--summit-surface-2);
  border-radius: 4px;
  margin-bottom: 6px;
}
.summit-skeleton-row__line--short { width: 40%; height: 11px; }
@keyframes summitShimmer {
  from { background-position: 0% 0; }
  to { background-position: -200% 0; }
}

/* ---------- Day section header (in bookmarks) ---------- */
.summit-day-head {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--summit-ink);
  padding: 16px 0 6px;
  border-bottom: 1px solid var(--summit-rule);
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.summit-day-head:first-child { padding-top: 0; }
.summit-day-head__count { color: var(--summit-ink-3); font-weight: 400; }

/* ---------- Link ---------- */
.summit-link,
.summit-link:visited,
.summit-link:active {
  color: var(--summit-accent);
  text-decoration: none;
  font-size: 12px;
  cursor: pointer;
}
.summit-link:hover { text-decoration: underline; }
`;
