import time
from playwright.sync_api import sync_playwright

def inspect_inputs():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        page = None
        for pg in ctx.pages:
            if "vercel.com" in pg.url and "domains" in pg.url:
                page = pg
                break
        if not page:
            print("No Vercel domains page found!")
            return
            
        print("Page URL:", page.url)
        
        # 1. Inspect default view
        print("--- Default View Inputs ---")
        for idx, inp in enumerate(page.locator("input, select, button").all()):
            try:
                if inp.is_visible():
                    print(f"  {idx}: tag={inp.evaluate('el => el.tagName.toLowerCase()')}, placeholder='{inp.get_attribute('placeholder') or ''}', value='{inp.get_attribute('value') or ''}', text='{inp.inner_text().strip()[:30]}'")
            except Exception:
                pass

        # 2. Select TXT
        print("--- Selecting TXT ---")
        select_el = page.locator("select").first
        select_el.select_option("TXT")
        time.sleep(2)
        
        for idx, inp in enumerate(page.locator("input, select, button").all()):
            try:
                if inp.is_visible():
                    print(f"  {idx}: tag={inp.evaluate('el => el.tagName.toLowerCase()')}, placeholder='{inp.get_attribute('placeholder') or ''}', value='{inp.get_attribute('value') or ''}', text='{inp.inner_text().strip()[:30]}'")
            except Exception:
                pass

        # 3. Select MX
        print("--- Selecting MX ---")
        select_el.select_option("MX")
        time.sleep(2)
        
        for idx, inp in enumerate(page.locator("input, select, button").all()):
            try:
                if inp.is_visible():
                    print(f"  {idx}: tag={inp.evaluate('el => el.tagName.toLowerCase()')}, placeholder='{inp.get_attribute('placeholder') or ''}', value='{inp.get_attribute('value') or ''}', text='{inp.inner_text().strip()[:30]}'")
            except Exception:
                pass

if __name__ == "__main__":
    inspect_inputs()
