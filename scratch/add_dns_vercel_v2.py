import time
import os
from playwright.sync_api import sync_playwright

DNS_RECORDS = [
    {"type": "TXT", "name": "resend._domainkey", "value": "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC0eBQW3PlkgEPy8hgcDSJ74jVY9WempJVvG2bhIaDQIobXL0Sjad1e5c1/CnIJpP/ANZRkfxnhjSRJXo5fz9yoIQWLnHlOL5V8XGmZvNSPip54iaLxmwqeka1E5q6LmSA+D9aQUV+0d3PD8aQtierZWZ8CqG2Tro4t2H41UUVjLQIDAQAB", "ttl": "60"},
    {"type": "MX",  "name": "send", "value": "feedback-smtp.ap-northeast-1.amazonses.com", "ttl": "60", "priority": "10"},
    {"type": "TXT", "name": "send", "value": "v=spf1 include:amazonses.com ~all", "ttl": "60"},
    {"type": "TXT", "name": "_dmarc", "value": "v=DMARC1; p=none;", "ttl": "60"},
    {"type": "MX",  "name": "", "value": "inbound-smtp.ap-northeast-1.amazonaws.com", "ttl": "60", "priority": "10"},
]

def add_all_dns():
    os.makedirs("shots", exist_ok=True)
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]

        page = None
        for pg in ctx.pages:
            if "vercel.com" in pg.url and "domains" in pg.url:
                page = pg
                break
        if not page:
            for pg in ctx.pages:
                if "vercel.com" in pg.url:
                    page = pg
                    break
        if not page:
            page = ctx.new_page()

        page.bring_to_front()

        # Navigate fresh to the domain detail page
        print("Navigating to vibcoders.com domain page...")
        page.goto("https://vercel.com/prabhu0077s-projects/~/domains/vibcoders.com", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        # Close any open dropdown by pressing Escape
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # First, scroll to the DNS Records section and take a baseline screenshot
        page.locator("text=DNS Records").first.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
        page.screenshot(path="shots/dns_baseline.png")

        # Check which records already exist
        body_text = page.locator("body").inner_text()
        existing_dkim = "resend._domainkey" in body_text
        existing_spf = "v=spf1 include:amazonses.com" in body_text
        existing_dmarc = "v=DMARC1" in body_text
        existing_mx_send = "feedback-smtp.ap-northeast-1.amazonses.com" in body_text
        existing_mx_root = "inbound-smtp.ap-northeast-1.amazonaws.com" in body_text
        
        print(f"Existing records check:")
        print(f"  DKIM (resend._domainkey TXT): {existing_dkim}")
        print(f"  SPF (send TXT): {existing_spf}")
        print(f"  DMARC (_dmarc TXT): {existing_dmarc}")
        print(f"  MX send: {existing_mx_send}")
        print(f"  MX root: {existing_mx_root}")

        records_to_add = []
        if not existing_dkim:
            records_to_add.append(DNS_RECORDS[0])
        if not existing_mx_send:
            records_to_add.append(DNS_RECORDS[1])
        if not existing_spf:
            records_to_add.append(DNS_RECORDS[2])
        if not existing_dmarc:
            records_to_add.append(DNS_RECORDS[3])
        if not existing_mx_root:
            records_to_add.append(DNS_RECORDS[4])
            
        if not records_to_add:
            print("All DNS records already exist! Nothing to add.")
        else:
            print(f"\nNeed to add {len(records_to_add)} records...")

        for i, rec in enumerate(records_to_add):
            r_type = rec["type"]
            r_name = rec["name"]
            r_val  = rec["value"]
            r_ttl  = rec.get("ttl", "60")
            r_prio = rec.get("priority", "")

            print(f"\n--- Adding record {i+1}/{len(records_to_add)}: {r_type} {r_name or '@'} ---")

            # Close any open dropdowns first
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # Scroll DNS form into view
            subdomain_input = page.locator("input[placeholder='subdomain']")
            subdomain_input.scroll_into_view_if_needed()
            page.wait_for_timeout(500)

            # 1. Select record type via the <select> element
            select_el = page.locator("select").first
            select_el.select_option(r_type)
            page.wait_for_timeout(1000)

            # 2. Fill subdomain/name
            subdomain_input.click()
            subdomain_input.fill("")  # clear first
            subdomain_input.fill(r_name)
            page.wait_for_timeout(500)

            # 3. Fill value — the placeholder changes based on type
            if r_type == "TXT":
                val_input = page.locator("input[placeholder='my example text']")
            elif r_type == "MX":
                val_input = page.locator("input[placeholder='mail.example.com']")
            else:
                val_input = page.locator("input[placeholder='76.76.21.21']")
            val_input.click()
            val_input.fill("")
            val_input.fill(r_val)
            page.wait_for_timeout(500)

            # 4. Fill TTL
            ttl_input = page.locator("input[placeholder='60']")
            ttl_input.click()
            ttl_input.fill("")
            ttl_input.fill(r_ttl)
            page.wait_for_timeout(300)

            # 5. Fill priority if MX
            if r_type == "MX" and r_prio:
                prio_input = page.locator("input[placeholder='10']").first
                prio_input.click()
                prio_input.fill("")
                prio_input.fill(r_prio)
                page.wait_for_timeout(300)

            # Close any popup / dropdown that might be covering the Add button
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

            # 6. Click the Add button using JavaScript to avoid overlay issues
            add_btn = page.locator("button:has-text('Add')").first
            add_btn.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            # Use force click to bypass any overlay
            add_btn.click(force=True)
            print(f"Clicked Add for {r_type} {r_name or '@'}")
            page.wait_for_timeout(4000)

            # Screenshot after each add
            safe_name = r_name.replace(".", "_") if r_name else "root"
            page.screenshot(path=f"shots/dns_v2_{i+1}_{r_type}_{safe_name}.png")
            print(f"Saved screenshot: shots/dns_v2_{i+1}_{r_type}_{safe_name}.png")

        # Final state — scroll down to see the records table
        print("\n=== Verifying records in table ===")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        
        # Reload to see clean state
        page.reload()
        page.wait_for_timeout(5000)
        
        # Click "Load More" if present to see all records
        load_more = page.locator("button:has-text('Load More')").first
        if load_more.is_visible():
            load_more.click()
            page.wait_for_timeout(3000)
            
        body_text = page.locator("body").inner_text()
        print(f"  DKIM present: {'resend._domainkey' in body_text}")
        print(f"  SPF present: {'v=spf1' in body_text}")
        print(f"  DMARC present: {'v=DMARC1' in body_text}")
        print(f"  MX send present: {'feedback-smtp' in body_text}")
        print(f"  MX root present: {'inbound-smtp' in body_text}")

        page.screenshot(path="shots/dns_v2_final_state.png")
        print("Saved final screenshot.")

        # Now switch to Resend and verify
        print("\nSwitching to Resend to trigger verification...")
        resend_page = None
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                resend_page = pg
                break
        if resend_page:
            resend_page.bring_to_front()
            resend_page.reload()
            resend_page.wait_for_timeout(5000)
            
            verify_btn = resend_page.locator("button:has-text('Verify')").first
            if verify_btn.is_visible():
                print("Clicking Verify DNS Records...")
                verify_btn.click()
                resend_page.wait_for_timeout(8000)
            
            resend_page.screenshot(path="shots/resend_v2_verification.png")
            print(f"Resend URL: {resend_page.url}")
            print("Saved Resend verification screenshot.")
        else:
            print("Resend tab not found.")

        print("\nDone!")

if __name__ == "__main__":
    add_all_dns()
