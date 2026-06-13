import time
from playwright.sync_api import sync_playwright

def login_vercel():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "vercel.com/login" in pg.url:
                page = pg
                break
        if not page:
            print("Vercel login page not open, searching for any vercel page...")
            for pg in ctx.pages:
                if "vercel.com" in pg.url:
                    page = pg
                    break
        if not page:
            print("Opening new Vercel login page...")
            page = ctx.new_page()
            page.goto("https://vercel.com/login?next=%2Fdashboard")
            time.sleep(3)
            
        page.bring_to_front()
        print("Clicking 'Continue with Google'...")
        google_btn = page.locator("button:has-text('Continue with Google'), a:has-text('Continue with Google')").first
        google_btn.click()
        
        print("Waiting for navigation / auth to complete...")
        time.sleep(8)
        
        print(f"Current URL: {page.url}")
        print(f"Current Title: {page.title()}")
        page.screenshot(path="shots/vercel_after_google_click.png")
        print("Saved screenshot to shots/vercel_after_google_click.png")

if __name__ == "__main__":
    login_vercel()
