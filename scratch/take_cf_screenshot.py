import time
from playwright.sync_api import sync_playwright

def capture():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                page = pg
                break
        if not page:
            print("No cloudflare page found!")
            return
            
        page.bring_to_front()
        # Wait for loading indicator to disappear or just sleep
        time.sleep(5)
        page.screenshot(path="shots/cf_r2_after_click_loaded.png")
        print(f"URL: {page.url}")
        print(f"Title: {page.title()}")
        
        # Check if there is any text on the page indicating a payment method is required
        body_text = page.locator("body").inner_text()
        print("Page text snippet:")
        print(body_text[:1000])

if __name__ == "__main__":
    capture()
