import json
import shutil
import tempfile
from pathlib import Path

import pytest
from upjack import UpjackApp

MANIFEST = Path(__file__).parent.parent / "manifest.json"
SEED_DIR = Path(__file__).parent.parent / "seed"


@pytest.fixture(scope="session")
def tmp_workspace():
    """Temporary workspace directory, cleaned up after all tests."""
    d = tempfile.mkdtemp(prefix="summit-test-")
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture(scope="session")
def upjack_app(tmp_workspace):
    """UpjackApp with seeded reference data."""
    import logging

    logging.getLogger("upjack.schema").setLevel(logging.ERROR)

    app = UpjackApp.from_manifest(str(MANIFEST), root=str(tmp_workspace))

    # Seed reference data
    for entity_type, filename in [
        ("speaker", "speakers.json"),
        ("sponsor", "sponsors.json"),
        ("session", "sessions.json"),
    ]:
        path = SEED_DIR / filename
        if path.exists():
            records = json.loads(path.read_text())
            for record in records:
                try:
                    app.create_entity(entity_type, record, created_by="system")
                except Exception:
                    pass

    logging.getLogger("upjack.schema").setLevel(logging.WARNING)
    return app
