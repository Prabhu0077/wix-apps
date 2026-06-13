import time
from playwright.sync_api import sync_playwright

ACCOUNT_ID = "317dee6de38fec1303a16f7070187a15"

def click_add():
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
        print("Navigating to R2 dashboard...")
        page.goto(f"https://dash.cloudflare.com/{ACCOUNT_ID}/r2/default")
        time.sleep(3)
        
        btn = page.locator("button:has-text('Add R2 subscription'), a:has-text('Add R2 subscription')").first
        print("Clicking 'Add R2 subscription to my account'...")
        btn.click(timeout=10000)
        time.sleep(5)
        page.screenshot(path="shots/cf_r2_after_click.png")
        print(f"New URL: {page.url}")

if __name__ == "__main__":
    click_add()
