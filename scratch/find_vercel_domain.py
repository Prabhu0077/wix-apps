import time
from playwright.sync_api import sync_playwright

def find_domain():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        page = None
        for pg in ctx.pages:
            if "vercel.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()
            
        page.bring_to_front()
        print("Navigating to Domains page...")
        page.goto("https://vercel.com/prabhu0077s-projects/~/domains", wait_until="networkidle")
        time.sleep(5)
        
        print("Current URL:", page.url)
        page.screenshot(path="shots/vercel_domains_list.png")
        print("Saved screenshot to shots/vercel_domains_list.png")
        
        # Check if we see vibcoders.com
        content = page.content()
        print("Does content contain 'vibcoders.com'?", "vibcoders.com" in content)
        print("Does content contain 'vibcoder.com'?", "vibcoder.com" in content)
        
        # Print list of links on page to find managing url
        for idx, a in enumerate(page.locator("a").all()):
            try:
                href = a.get_attribute("href")
                txt = a.inner_text().strip()
                if "domain" in href or "vibcoder" in href or "vibcoder" in txt:
                    print(f"Link {idx}: Text='{txt}', Href='{href}'")
            except Exception:
                pass

if __name__ == "__main__":
    find_domain()
