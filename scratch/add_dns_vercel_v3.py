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
            if "vercel.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()

        page.bring_to_front()

        # Navigate fresh
        print("Navigating to vibcoders.com domain page...")
        page.goto("https://vercel.com/prabhu0077s-projects/~/domains/vibcoders.com", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        # Close any banners / modals / dropdowns
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # Close the "Ship" banner if visible
        close_banner = page.locator("button:has-text('×'), [aria-label='Close'], [aria-label='Dismiss']")
        if close_banner.count() > 0:
            try:
                close_banner.first.click(timeout=2000)
                page.wait_for_timeout(500)
            except Exception:
                pass

        for i, rec in enumerate(DNS_RECORDS):
            r_type = rec["type"]
            r_name = rec["name"]
            r_val  = rec["value"]
            r_ttl  = rec.get("ttl", "60")
            r_prio = rec.get("priority", "")

            print(f"\n--- Adding record {i+1}/{len(DNS_RECORDS)}: {r_type} {r_name or '@'} ---")

            # Scroll the form into view by targeting the heading
            page.locator("h2:has-text('DNS Records')").scroll_into_view_if_needed()
            page.wait_for_timeout(1000)

            # CRITICAL: Click the page heading to close any open "Add DNS Preset" dropdown
            page.locator("h2:has-text('DNS Records')").click()
            page.wait_for_timeout(500)

            # 1. Select record type using JavaScript to avoid triggering UI side effects
            select_el = page.locator("select").first
            page.evaluate(f"""() => {{
                const sel = document.querySelector('select');
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                nativeInputValueSetter.call(sel, '{r_type}');
                sel.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}""")
            page.wait_for_timeout(1500)

            # 2. Fill subdomain/name
            subdomain_input = page.locator("input[placeholder='subdomain']")
            subdomain_input.click()
            subdomain_input.fill("")
            subdomain_input.fill(r_name)
            page.wait_for_timeout(500)

            # 3. Fill value
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

            # CRITICAL: Click the heading again to dismiss any dropdown that may have appeared
            page.locator("h2:has-text('DNS Records')").click()
            page.wait_for_timeout(500)

            # Check if the "Add DNS Preset" dropdown is still visible and close it
            preset_dropdown = page.locator("text=Select a DNS Record Preset")
            if preset_dropdown.is_visible():
                print("  Preset dropdown still visible, clicking away...")
                page.mouse.click(800, 200)  # click on an empty area
                page.wait_for_timeout(500)

            # 6. Click the Add button via JavaScript to guarantee it works
            print("  Clicking Add button via JS...")
            clicked = page.evaluate("""() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const addBtn = buttons.find(b => b.textContent.trim() === 'Add');
                if (addBtn) {
                    addBtn.click();
                    return true;
                }
                return false;
            }""")
            
            if not clicked:
                print("  WARNING: Could not find Add button via JS, trying locator...")
                add_btn = page.locator("button:has-text('Add')").first
                add_btn.click(force=True)
                
            print(f"  Add clicked for {r_type} {r_name or '@'}")
            page.wait_for_timeout(4000)

            safe_name = r_name.replace(".", "_") if r_name else "root"
            page.screenshot(path=f"shots/dns_v3_{i+1}_{r_type}_{safe_name}.png")

        # Verify by reloading
        print("\n=== Reloading to verify ===")
        page.reload()
        page.wait_for_timeout(5000)
        
        # Click "Load More" if present
        load_more = page.locator("button:has-text('Load More')").first
        if load_more.is_visible():
            load_more.click()
            page.wait_for_timeout(3000)

        body_text = page.locator("body").inner_text()
        results = {
            "DKIM": "resend._domainkey" in body_text,
            "SPF": "v=spf1" in body_text or "amazonses" in body_text,
            "DMARC": "DMARC1" in body_text,
            "MX_send": "feedback-smtp" in body_text,
            "MX_root": "inbound-smtp" in body_text,
        }
        print("Verification results:")
        for k, v in results.items():
            status = "✓ FOUND" if v else "✗ MISSING"
            print(f"  {k}: {status}")

        page.screenshot(path="shots/dns_v3_final.png")

        # Resend verification
        print("\nSwitching to Resend...")
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
                verify_btn.click()
                resend_page.wait_for_timeout(8000)
            resend_page.screenshot(path="shots/resend_v3_result.png")
            print(f"Resend URL: {resend_page.url}")

        print("\nDone!")

if __name__ == "__main__":
    add_all_dns()
