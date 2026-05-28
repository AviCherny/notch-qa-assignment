import os

UI_BASE_URL = os.getenv("UI_BASE_URL", "https://example.com")

# Playwright
PLAYWRIGHT_HEADLESS = os.getenv("HEADED") != "true"
PLAYWRIGHT_TIMEOUT = 15_000
PLAYWRIGHT_VIDEO_DIR = "videos/"
PLAYWRIGHT_TRACE_DIR = "traces/"
