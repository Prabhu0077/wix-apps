import time
from playwright.sync_api import sync_playwright

def check_status():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                page = pg
                break
        if not page:
            print("No Cloudflare page found!")
            return
            
        page.bring_to_front()
        print(f"Current URL: {page.url}")
        print(f"Current Title: {page.title()}")
        page.screenshot(path="shots/cf_status_check.png")
        print("Saved screenshot to shots/cf_status_check.png")

if __name__ == "__main__":
    check_status()
