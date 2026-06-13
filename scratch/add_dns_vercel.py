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

        # Make sure we're on the vibcoders.com domain detail page
        if "vibcoders.com" not in page.url:
            page.goto("https://vercel.com/prabhu0077s-projects/~/domains/vibcoders.com", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

        print(f"On page: {page.url}")

        for i, rec in enumerate(DNS_RECORDS):
            r_type = rec["type"]
            r_name = rec["name"]
            r_val  = rec["value"]
            r_ttl  = rec.get("ttl", "60")
            r_prio = rec.get("priority", "")

            print(f"\n--- Adding record {i+1}/{len(DNS_RECORDS)}: {r_type} {r_name or '@'} ---")

            # Scroll DNS Records form into view
            page.locator("input[placeholder='subdomain']").scroll_into_view_if_needed()
            page.wait_for_timeout(500)

            # 1. Select record type
            select_el = page.locator("select").first
            select_el.select_option(r_type)
            page.wait_for_timeout(1000)

            # 2. Fill subdomain/name (element 25)
            name_input = page.locator("input[placeholder='subdomain']")
            name_input.click()
            name_input.fill(r_name)
            page.wait_for_timeout(500)

            # 3. Fill value (element 27 — placeholder changes by type)
            if r_type == "TXT":
                val_input = page.locator("input[placeholder='my example text']")
            elif r_type == "MX":
                val_input = page.locator("input[placeholder='mail.example.com']")
            else:
                val_input = page.locator("input[placeholder='76.76.21.21']")
            val_input.click()
            val_input.fill(r_val)
            page.wait_for_timeout(500)

            # 4. Fill TTL (element 28)
            ttl_input = page.locator("input[placeholder='60']")
            ttl_input.click()
            ttl_input.fill("")
            ttl_input.fill(r_ttl)
            page.wait_for_timeout(300)

            # 5. Fill priority if MX (element 29)
            if r_type == "MX" and r_prio:
                prio_input = page.locator("input[placeholder='10']").first
                prio_input.click()
                prio_input.fill(r_prio)
                page.wait_for_timeout(300)

            # 6. Click Add
            add_btn = page.locator("button:has-text('Add')").first
            add_btn.click()
            print(f"Clicked Add for {r_type} {r_name or '@'}")
            page.wait_for_timeout(3000)

            # Screenshot after each add
            safe_name = r_name.replace(".", "_") if r_name else "root"
            page.screenshot(path=f"shots/dns_added_{i+1}_{r_type}_{safe_name}.png")
            print(f"Saved screenshot: shots/dns_added_{i+1}_{r_type}_{safe_name}.png")

        print("\n=== All 5 DNS records submitted! ===")
        page.screenshot(path="shots/dns_all_added_final.png")

        # Now switch to Resend and click Verify
        print("\nSwitching to Resend to verify domain...")
        resend_page = None
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                resend_page = pg
                break
        if resend_page:
            resend_page.bring_to_front()
            resend_page.reload()
            resend_page.wait_for_timeout(5000)
            resend_page.screenshot(path="shots/resend_after_dns.png")
            print(f"Resend page URL: {resend_page.url}")
            
            # Look for Verify DNS Records button
            verify_btn = resend_page.locator("button:has-text('Verify')").first
            if verify_btn.is_visible():
                print("Clicking Verify DNS Records...")
                verify_btn.click()
                resend_page.wait_for_timeout(8000)
                resend_page.screenshot(path="shots/resend_verification_result.png")
                print("Saved verification result screenshot.")
            else:
                print("No Verify button visible. Domain may already be verified or still propagating.")
                resend_page.screenshot(path="shots/resend_no_verify_btn.png")
        else:
            print("Resend tab not found. You can verify manually at https://resend.com/domains")

        print("\nDone!")

if __name__ == "__main__":
    add_all_dns()
