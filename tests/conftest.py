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
import os
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

from config import BASE_URL, TIMEOUTS

AUTH_FILE       = Path(__file__).parent.parent / "auth" / "auth.json"
BROWSER_PROFILE = Path(__file__).parent.parent / ".browser-profile"


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
    print("[auth] Session created from env tokens.")


def _interactive_login() -> None:
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

    print("[auth] Login successful. Session saved to auth/auth.json\n")


@pytest.fixture(scope="session", autouse=True)
def ensure_auth() -> None:
    """Runs once before the suite — ensures auth/auth.json exists."""
    if AUTH_FILE.exists():
        print("[auth] Reusing saved session.")
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
    )
    ctx.set_default_timeout(TIMEOUTS["element"])
    ctx.set_default_navigation_timeout(TIMEOUTS["navigation"])
    yield ctx
    ctx.close()


@pytest.fixture
def page(context):
    """One page per test, closed after the test completes."""
    p = context.new_page()
    yield p
    p.close()
