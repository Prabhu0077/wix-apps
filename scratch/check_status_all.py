import time
import os
from playwright.sync_api import sync_playwright

def check_r2_and_resend():
    os.makedirs("shots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]

        # Check Cloudflare R2 status
        cf_page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                cf_page = pg
                break
        
        if cf_page:
            cf_page.bring_to_front()
            print(f"Cloudflare URL: {cf_page.url}")
            print(f"Cloudflare Title: {cf_page.title()}")
            cf_page.screenshot(path="shots/cf_r2_current_state.png")
            
            # Check if we're still on payment page or have moved past it
            if "checkout" in cf_page.url or "payment" in cf_page.url:
                print("STATUS: Still on R2 payment/checkout page. User needs to enter card details.")
            elif "r2" in cf_page.url:
                print("STATUS: R2 appears to be activated! On R2 dashboard.")
            else:
                print(f"STATUS: On unexpected page: {cf_page.url}")
        else:
            print("No Cloudflare tab found.")

        # Check Resend verification status
        resend_page = None
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                resend_page = pg
                break
        
        if resend_page:
            resend_page.bring_to_front()
            resend_page.reload()
            resend_page.wait_for_timeout(5000)
            print(f"\nResend URL: {resend_page.url}")
            
            # Check domain status
            body = resend_page.locator("body").inner_text()
            if "Verified" in body:
                print("RESEND STATUS: Domain VERIFIED! ✓")
            elif "Pending" in body:
                print("RESEND STATUS: Domain still Pending (DNS propagation in progress)")
            else:
                print("RESEND STATUS: Unknown")
            
            resend_page.screenshot(path="shots/resend_latest_status.png")
        else:
            print("No Resend tab found.")

if __name__ == "__main__":
    check_r2_and_resend()
