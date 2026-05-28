import logging
import os
import pytest
import allure
from pathlib import Path
from playwright.sync_api import sync_playwright
from config import PLAYWRIGHT_HEADLESS, PLAYWRIGHT_TIMEOUT, PLAYWRIGHT_VIDEO_DIR, PLAYWRIGHT_TRACE_DIR


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        logging.info("[browser] Chromium launched")
        yield browser


@pytest.fixture
def page(browser, request):
    context = browser.new_context(
        accept_downloads=True,
        record_video_dir=PLAYWRIGHT_VIDEO_DIR,
    )
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    console_errors: list[str] = []
    page = context.new_page()
    page.set_default_timeout(PLAYWRIGHT_TIMEOUT)
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    logging.info(f"[page] New page opened for {request.node.name}")
    yield page
    rep_setup = getattr(request.node, "rep_setup", None)
    rep_call = getattr(request.node, "rep_call", None)
    failed = (
        (rep_setup is not None and rep_setup.failed)
        or (rep_call is not None and rep_call.failed)
        or (rep_call is not None and hasattr(rep_call, "wasxfail") and not rep_call.passed)
    )
    try:
        if failed:
            allure.attach(
                page.screenshot(),
                name="screenshot_on_failure",
                attachment_type=allure.attachment_type.PNG,
            )
            if console_errors:
                allure.attach(
                    "\n".join(console_errors),
                    name="console_errors",
                    attachment_type=allure.attachment_type.TEXT,
                )
            os.makedirs(PLAYWRIGHT_TRACE_DIR, exist_ok=True)
            trace_path = f"{PLAYWRIGHT_TRACE_DIR}/{request.node.name}.zip"
            context.tracing.stop(path=trace_path)
            logging.info(f"[page] Trace saved → {trace_path} (open at trace.playwright.dev)")
        else:
            context.tracing.stop()
    finally:
        video = page.video
        page.close()
        context.close()
        if video:
            if failed:
                allure.attach(
                    Path(video.path()).read_bytes(),
                    name="video_on_failure",
                    attachment_type=allure.attachment_type.WEBM,
                )
            else:
                video.delete()
