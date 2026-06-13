import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    print("Connecting to Chrome on port 9222...")
    browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = browser.contexts[0]

    # Open Resend
    print("Opening Resend Domains...")
    page_resend = ctx.new_page()
    page_resend.goto("https://resend.com/domains", timeout=30000)
    print("Resend tab opened.")

    # Open Cloudflare
    print("Opening Cloudflare...")
    page_cf = ctx.new_page()
    page_cf.goto("https://dash.cloudflare.com/", timeout=30000)
    print("Cloudflare tab opened.")

    time.sleep(2)
    
    # Close any blank pages
    for pg in ctx.pages:
        if pg.url in ["chrome://newtab/", "chrome://new-tab-page/", "about:blank"]:
            pg.close()

    print("Done opening tabs!")
