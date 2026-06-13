import time
import os
from playwright.sync_api import sync_playwright

def test_dns_flow():
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
        print("Navigating to Domains dashboard...")
        page.goto("https://vercel.com/prabhu0077s-projects/~/domains", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        page.screenshot(path="shots/test_domains_dashboard.png")
        
        # Look for domain links
        print("Listing all links containing vibcoder:")
        links = page.locator("a").all()
        for idx, a in enumerate(links):
            txt = a.inner_text().strip()
            href = a.get_attribute("href") or ""
            if "vibcoder" in txt or "vibcoder" in href:
                print(f"  Link {idx}: Text='{txt}', Href='{href}'")
                
        # Click vibcoders.com
        target_domain = "vibcoders.com"
        domain_link = page.locator(f"a:has-text('{target_domain}')").first
        if domain_link.count() > 0:
            print(f"Found {target_domain}. Clicking...")
            domain_link.click()
        else:
            print(f"{target_domain} not found, clicking first link containing 'vibcoder'")
            found = False
            for a in links:
                txt = a.inner_text().strip()
                if "vibcoder" in txt:
                    print(f"Clicking link: {txt}")
                    a.click()
                    found = True
                    break
            if not found:
                raise Exception("No domain link found!")
                
        page.wait_for_timeout(5000)
        print("Domain Detail Page URL:", page.url)
        page.screenshot(path="shots/test_domain_detail.png")
        
        # Inspect form inputs and headings
        print("Headings:")
        for idx, h in enumerate(page.locator("h1, h2, h3").all()):
            print(f"  Heading {idx}: {h.inner_text().strip()}")
            
        print("Inputs/Buttons on Detail Page:")
        inputs = page.locator("input, select, button").all()
        for idx, inp in enumerate(inputs):
            try:
                tag = inp.evaluate("el => el.tagName.toLowerCase()")
                name = inp.get_attribute("name") or ""
                placeholder = inp.get_attribute("placeholder") or ""
                txt = inp.inner_text().strip() or inp.get_attribute("value") or ""
                print(f"  Element {idx}: Tag={tag}, Name='{name}', Placeholder='{placeholder}', Value/Text='{txt[:50]}'")
            except Exception:
                pass

if __name__ == "__main__":
    test_dns_flow()
