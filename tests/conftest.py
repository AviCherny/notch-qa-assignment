"""
Session-level fixtures and auth setup.

Auth strategy (in order of preference):

  1. Saved session (auth/auth.json) — reused if it exists.
     To force re-login: delete auth/auth.json and re-run.

  2. Token injection via environment variables (CI path).
     Set NOTCH_DS_TOKEN and NOTCH_DSR_TOKEN to the values of the DS and DSR
     cookies from browser DevTools (Application → Cookies).
     Store as GitHub secrets — the CI workflow injects them automatically.

  3. Interactive login — opens a headed Chrome window, waits for the user
     to complete Google OAuth manually (up to 5 minutes). Session is saved
     so subsequent runs skip this step.
"""

import json
import logging
import os
from pathlib import Path

import allure
import pytest
from playwright.sync_api import sync_playwright

from config import BASE_URL, PLAYWRIGHT_TRACE_DIR, PLAYWRIGHT_VIDEO_DIR, TIMEOUTS

AUTH_FILE       = Path(__file__).parent.parent / "auth" / "auth.json"
BROWSER_PROFILE = Path(__file__).parent.parent / ".browser-profile"


# ---------------------------------------------------------------------------
# Failure diagnostics hook — must be at module level to capture call outcome
# ---------------------------------------------------------------------------

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)


# ---------------------------------------------------------------------------
# Auth setup
# ---------------------------------------------------------------------------

def _create_auth_from_tokens(ds: str, dsr: str) -> None:
    domain = BASE_URL.replace("https://", "").replace("http://", "").split("/")[0]
    auth_state = {
        "cookies": [
            {
                "name": "DS", "value": ds,
                "domain": domain, "path": "/",
                "httpOnly": True, "secure": True, "sameSite": "Lax", "expires": -1,
            },
            {
                "name": "DSR", "value": dsr,
                "domain": domain, "path": "/",
                "httpOnly": True, "secure": True, "sameSite": "Lax", "expires": -1,
            },
        ],
        "origins": [],
    }
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUTH_FILE.write_text(json.dumps(auth_state, indent=2))
    logging.info("[auth] Session created from env tokens.")


def _interactive_login() -> None:
    logging.info("[auth] No saved session — opening browser for Google login.")
    print("\n[auth] No saved session found.")
    print("[auth] Opening browser — please sign in with Google.")
    print("[auth] You have 5 minutes.\n")

    BROWSER_PROFILE.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            str(BROWSER_PROFILE),
            headless=False,
            channel="chrome",
            viewport={"width": 1440, "height": 900},
        )
        page = browser.new_page()
        page.goto(f"{BASE_URL}/config/guardrails")
        page.bring_to_front()

        page.wait_for_url(
            lambda url: "getnotch.dev" in url and "/login" not in url,
            timeout=300_000,
        )
        page.wait_for_load_state("networkidle")

        AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
        browser.storage_state(path=str(AUTH_FILE))
        browser.close()

    logging.info("[auth] Login successful. Session saved.")


@pytest.fixture(scope="session", autouse=True)
def ensure_auth() -> None:
    """Runs once before the suite — ensures auth/auth.json exists."""
    if AUTH_FILE.exists():
        logging.info("[auth] Reusing saved session.")
        return

    ds  = os.getenv("NOTCH_DS_TOKEN")
    dsr = os.getenv("NOTCH_DSR_TOKEN")
    if ds and dsr:
        _create_auth_from_tokens(ds, dsr)
        return

    _interactive_login()


# ---------------------------------------------------------------------------
# Browser fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args: dict) -> dict:
    """Use real Chrome channel (avoids Google bot detection for auth)."""
    return {**browser_type_launch_args, "channel": "chrome"}


@pytest.fixture
def context(ensure_auth, browser):
    """Fresh browser context per test, pre-loaded with the saved session."""
    ctx = browser.new_context(
        storage_state=str(AUTH_FILE),
        viewport={"width": 1440, "height": 900},
        base_url=BASE_URL,
        record_video_dir=PLAYWRIGHT_VIDEO_DIR,
    )
    ctx.set_default_timeout(TIMEOUTS["element"])
    ctx.set_default_navigation_timeout(TIMEOUTS["navigation"])
    ctx.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield ctx
    ctx.close()


@pytest.fixture
def page(context, request):
    """
    One page per test with automatic failure diagnostics.

    On failure:
      - Screenshot attached to the Allure report
      - Playwright trace saved to traces/<test_name>.zip
        (open at https://trace.playwright.dev)
    """
    p = context.new_page()
    yield p

    rep_call = getattr(request.node, "rep_call", None)
    failed = rep_call is not None and (
        rep_call.failed
        or (hasattr(rep_call, "wasxfail") and not rep_call.passed)
    )

    video = p.video  # capture before close; finalized on p.close()
    try:
        if failed:
            allure.attach(
                p.screenshot(),
                name="screenshot_on_failure",
                attachment_type=allure.attachment_type.PNG,
            )
            os.makedirs(PLAYWRIGHT_TRACE_DIR, exist_ok=True)
            trace_path = f"{PLAYWRIGHT_TRACE_DIR}/{request.node.name}.zip"
            context.tracing.stop(path=trace_path)
            logging.info(f"[trace] Saved → {trace_path}  (open at trace.playwright.dev)")
        else:
            context.tracing.stop()
    finally:
        p.close()
        if video:
            video_path = video.path()
            if failed:
                with open(video_path, "rb") as f:
                    allure.attach(
                        f.read(),
                        name="video_on_failure",
                        attachment_type=allure.attachment_type.MP4,
                    )
            Path(video_path).unlink(missing_ok=True)
