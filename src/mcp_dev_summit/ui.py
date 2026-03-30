"""UI resource loader for MCP Dev Summit Companion.

In development: run `cd ui && npm run dev` for HMR via Vite.
In production: `cd ui && npm run build` produces a single-file HTML bundle
at ui/dist/index.html, which the server reads and serves as a ui:// resource.

Fallback: if no built UI exists, serves a minimal inline HTML.
"""

from pathlib import Path

_UI_DIR = Path(__file__).resolve().parent.parent.parent / "ui" / "dist"


def load_ui() -> str:
    """Load the built single-file HTML, or fall back to inline HTML."""
    built = _UI_DIR / "index.html"
    if built.exists():
        return built.read_text()
    return FALLBACK_HTML


FALLBACK_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif);
    background: var(--color-background-primary, #0f172a);
    color: var(--color-text-primary, #e2e8f0);
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 2rem;
  }
  .c { max-width: 480px; width: 100%; text-align: center; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  p { color: var(--color-text-secondary, #94a3b8); font-size: 0.9rem; line-height: 1.5; }
  code {
    display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem;
    background: var(--color-background-secondary, #1e293b); border: 1px solid var(--color-border-primary, #334155);
    border-radius: 6px; font-size: 0.85rem;
  }
</style>
</head>
<body>
<div class="c">
  <h1>MCP Dev Summit Companion</h1>
  <p>UI not built yet. Build it with:</p>
  <code>cd ui && npm install && npm run build</code>
</div>
</body>
</html>
"""
