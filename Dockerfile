FROM python:3.13-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency spec first for layer caching
COPY pyproject.toml .

# Install production deps only
RUN uv pip install --system .

# Copy server source
COPY src/ src/

# Copy Upjack assets (manifest, schemas, skills, context, seed data)
COPY manifest.json .
COPY schemas/ schemas/
COPY skills/ skills/
COPY context.md .
COPY seed/ seed/

# Hosted mode — read-only, no personal data persistence
ENV MCP_SUMMIT_MODE=hosted

EXPOSE 8000

CMD ["uvicorn", "mcp_dev_summit.server:app", "--host", "0.0.0.0", "--port", "8000"]
