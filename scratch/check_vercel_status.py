import time
from playwright.sync_api import sync_playwright

def check_vercel():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        # Check if vercel.com tab is already open, otherwise create a new one
        page = None
        for pg in ctx.pages:
            if "vercel.com" in pg.url:
                page = pg
                break
        if not page:
            print("Opening new Vercel tab...")
            page = ctx.new_page()
            
        page.bring_to_front()
        print(f"Navigating to Vercel dashboard...")
        page.goto("https://vercel.com/dashboard", wait_until="domcontentloaded")
        time.sleep(5)
        print(f"Current URL: {page.url}")
        print(f"Current Title: {page.title()}")
        page.screenshot(path="shots/vercel_status.png")
        print("Saved screenshot to shots/vercel_status.png")

if __name__ == "__main__":
    check_vercel()
