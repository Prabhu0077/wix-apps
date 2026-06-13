import time
from playwright.sync_api import sync_playwright

def inspect_html():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        page = [pg for pg in ctx.pages if "resend.com" in pg.url][0]
        page.bring_to_front()
        
        # Get the HTML of the main container or tables
        tables = page.locator("table").all()
        for idx, table in enumerate(tables):
            html = table.inner_html()
            print(f"--- Table {idx} HTML ---")
            print(html)
            print("------------------------\n")

if __name__ == "__main__":
    inspect_html()
