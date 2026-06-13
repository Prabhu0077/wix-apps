import time
import json
from playwright.sync_api import sync_playwright

def extract_dns():
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
            print("No resend.com tab open!")
            return
            
        page.bring_to_front()
        time.sleep(1)
        
        # Function to clean and resolve cell content
        def get_cell_value(cell):
            # Check for copy buttons (which contain the full text in aria-label)
            copy_btn = cell.locator("[role='button'][aria-label^='Copy']").first
            if copy_btn.count() > 0:
                aria_label = copy_btn.get_attribute("aria-label")
                if aria_label and aria_label.startswith("Copy "):
                    return aria_label[5:] # remove "Copy "
            return cell.inner_text().strip()

        tables = page.locator("table").all()
        print(f"Found {len(tables)} tables.")
        
        dns_records = []
        for t_idx, table in enumerate(tables):
            # Let's get header
            headers = []
            th_elements = table.locator("thead th").all()
            for th in th_elements:
                headers.append(th.inner_text().strip())
            
            rows = table.locator("tbody tr").all()
            for r_idx, row in enumerate(rows):
                cells = row.locator("td").all()
                row_data = {}
                for c_idx, cell in enumerate(cells):
                    header_name = headers[c_idx] if c_idx < len(headers) else f"col_{c_idx}"
                    val = get_cell_value(cell)
                    row_data[header_name] = val
                
                print(f"Table {t_idx} Row {r_idx}: {row_data}")
                dns_records.append(row_data)
                
        with open("scratch/dns_records_full.json", "w") as f:
            json.dump(dns_records, f, indent=2)
        print("Saved complete DNS records to scratch/dns_records_full.json")

if __name__ == "__main__":
    extract_dns()
