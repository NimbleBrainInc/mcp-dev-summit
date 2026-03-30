VERSION ?= 0.1.0

.PHONY: help install run run-http test check format format-check lint lint-fix typecheck clean bump bundle

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install the package with dev dependencies
	uv pip install -e . --group dev

run: ## Run the MCP server (stdio)
	uv run python -m mcp_dev_summit.server

run-http: ## Run HTTP server with uvicorn
	uv run uvicorn mcp_dev_summit.server:app --host 0.0.0.0 --port 8000

test: ## Run tests with pytest
	uv run pytest tests/ -v

format: ## Format code with ruff
	uv run ruff format src/ tests/

format-check: ## Check code formatting with ruff
	uv run ruff format --check src/ tests/

lint: ## Lint code with ruff
	uv run ruff check src/ tests/

lint-fix: ## Lint and fix code with ruff
	uv run ruff check --fix src/ tests/

typecheck: ## Type check with ty
	uv run ty check src/

check: format-check lint typecheck test ## Run all checks

bundle: ## Build MCPB bundle locally
	@cd ui && npm run build
	@./scripts/build-bundle.sh . $(VERSION)

clean: ## Clean up artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

bump: ## Bump version across all files (usage: make bump VERSION=0.2.0)
	@if [ -z "$(VERSION)" ]; then echo "Usage: make bump VERSION=x.y.z"; exit 1; fi
	@echo "Bumping version to $(VERSION)..."
	@sed -i '' 's/^version = ".*"/version = "$(VERSION)"/' pyproject.toml
	@sed -i '' 's/^__version__ = ".*"/__version__ = "$(VERSION)"/' src/mcp_dev_summit/__init__.py
	@jq --arg v "$(VERSION)" '.version = $$v' manifest.json > manifest.tmp.json && mv manifest.tmp.json manifest.json
	@jq --arg v "$(VERSION)" '.version = $$v' server.json > server.tmp.json && mv server.tmp.json server.json
	@echo "Updated:"
	@echo "  pyproject.toml:                   $$(grep '^version' pyproject.toml)"
	@echo "  src/mcp_dev_summit/__init__.py:   $$(grep '__version__' src/mcp_dev_summit/__init__.py)"
	@echo "  manifest.json:                    $$(jq -r '.version' manifest.json)"
	@echo "  server.json:                      $$(jq -r '.version' server.json)"
