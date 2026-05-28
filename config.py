import os

BASE_URL = os.getenv("NOTCH_BASE_URL", "https://guardio.app.getnotch.dev")

TIMEOUTS = {
    "navigation": 30_000,
    "element":    10_000,
    "result":     15_000,
}

PLAYWRIGHT_TRACE_DIR = "traces/"
PLAYWRIGHT_VIDEO_DIR = "videos/"
