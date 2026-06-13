import time
import re
from playwright.sync_api import sync_playwright

def navigate_cf():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()
            
        page.bring_to_front()
        print("Navigating to https://dash.cloudflare.com/ ...")
        page.goto("https://dash.cloudflare.com/")
        time.sleep(4)
        
        # Take screenshot of current page
        page.screenshot(path="shots/cf_nav_1.png")
        print(f"Current URL: {page.url}")
        
        # If we see "Go to account home", click it
        go_home = page.locator("a:has-text('Go to account home')").first
        if go_home.count() > 0:
            print("Clicking 'Go to account home'...")
            go_home.click()
            time.sleep(5)
            print(f"URL after click: {page.url}")
            page.screenshot(path="shots/cf_nav_2.png")
        else:
            # Maybe click "Personal" or check if we are already in dashboard
            print("No 'Go to account home' button, checking if we can click 'Personal'...")
            personal_btn = page.locator("text=Personal").first
            if personal_btn.count() > 0:
                personal_btn.click()
                time.sleep(4)
                print(f"URL after clicking Personal: {page.url}")
                page.screenshot(path="shots/cf_nav_2.png")
                
        # Get Account ID from URL
        match = re.search(r"dash\.cloudflare\.com/([a-f0-9]{32})", page.url)
        if match:
            print(f"FOUND CLOUDFLARE ACCOUNT ID: {match.group(1)}")
            with open("scratch/cf_account_id.txt", "w") as f:
                f.write(match.group(1))
        else:
            print("Could not find Cloudflare Account ID in URL. Checking page content...")
            body_text = page.locator("body").inner_text()
            print(body_text[:500])

if __name__ == "__main__":
    navigate_cf()
