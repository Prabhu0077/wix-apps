import time
import json
from playwright.sync_api import sync_playwright

def get_dns():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()
            
        page.bring_to_front()
        print("Navigating to https://resend.com/domains ...")
        page.goto("https://resend.com/domains")
        time.sleep(3)
        
        # Check if we are on the Add Domain wizard or domains list
        # If we see vibcoders.com in a list or if we see the wizard
        content = page.content()
        if "vibcoders.com" in content:
            print("vibcoders.com found on page.")
            # If there's a manual setup button
            manual_btn = page.locator("button:has-text('Manual setup')").first
            if manual_btn.count() > 0:
                print("Clicking Manual setup button...")
                manual_btn.click()
                time.sleep(3)
            else:
                # Maybe click on vibcoders.com in the table/list
                table_link = page.locator("tr a:has-text('vibcoders.com'), td a:has-text('vibcoders.com')").first
                if table_link.count() > 0:
                    print("Clicking vibcoders.com link in domains list...")
                    table_link.click()
                    time.sleep(3)
        else:
            print("vibcoders.com not found on page! We might need to add it.")
            
        page.screenshot(path="shots/resend_dns_manual_page.png")
        print("Saved screenshot to shots/resend_dns_manual_page.png")
        
        # Let's extract all rows and columns from any table on the page
        tables = page.locator("table").all()
        print(f"Found {len(tables)} tables on page.")
        dns_records = []
        for t_idx, table in enumerate(tables):
            rows = table.locator("tr").all()
            print(f"Table {t_idx} has {len(rows)} rows.")
            for r_idx, row in enumerate(rows):
                cols = row.locator("td, th").all()
                col_texts = [col.inner_text().strip().replace("\n", " ") for col in cols]
                if col_texts:
                    print(f"Row {r_idx}: {col_texts}")
                    dns_records.append(col_texts)
                    
        # If no tables found, try listing all spans and divs with class or text
        if not dns_records:
            print("No tables found. Printing page text summary:")
            body_text = page.locator("body").inner_text()
            print(body_text[:1000])
            
        with open("scratch/dns_records_extracted.json", "w") as f:
            json.dump(dns_records, f, indent=2)

if __name__ == "__main__":
    get_dns()
