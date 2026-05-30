import os

BASE_URL = os.getenv("NOTCH_BASE_URL", "https://guardio.app.getnotch.dev")

TIMEOUTS = {
    "navigation": 60_000,
    "element":    60_000,
    "result":     60_000,
}

PLAYWRIGHT_TRACE_DIR = "traces/"
PLAYWRIGHT_VIDEO_DIR = "videos/"
