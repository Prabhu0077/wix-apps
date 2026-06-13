import time
from playwright.sync_api import sync_playwright

def inspect_vercel():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        page = None
        for pg in ctx.pages:
            if "vercel.com/login" in pg.url or "vercel.com" in pg.url:
                page = pg
                break
        if not page:
            print("No Vercel page found!")
            return
            
        print("Page URL:", page.url)
        print("Buttons:")
        for idx, btn in enumerate(page.locator("button").all()):
            print(f"  Button {idx}: Text='{btn.inner_text().strip()}', Class='{btn.get_attribute('class')}'")
            
        print("Links:")
        for idx, a in enumerate(page.locator("a").all()):
            print(f"  Link {idx}: Text='{a.inner_text().strip()}', Href='{a.get_attribute('href')}'")
            
        print("Role buttons:")
        for idx, r in enumerate(page.locator("[role='button']").all()):
            print(f"  RoleBtn {idx}: Text='{r.inner_text().strip()}', Class='{r.get_attribute('class')}'")

if __name__ == "__main__":
    inspect_vercel()
