import os

BASE_URL = os.getenv("NOTCH_BASE_URL", "https://guardio.app.getnotch.dev")

TIMEOUTS = {
    "navigation": 30_000,
    "element":    30_000,
    "result":     30_000,
}

PLAYWRIGHT_TRACE_DIR = "traces/"
PLAYWRIGHT_VIDEO_DIR = "videos/"
