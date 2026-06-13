import os
import time
import json
from playwright.sync_api import sync_playwright

def configure_resend():
    with sync_playwright() as p:
        print("Connecting to Chrome on port 9222...")
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        ctx = browser.contexts[0]
        page = ctx.pages[0] # Resend tab
        page.bring_to_front()
        time.sleep(2)

        credentials = {}

        # 1. Add Domain vibcoders.com
        print("Navigating to Resend Domains page...")
        page.goto("https://resend.com/domains", timeout=30000)
        time.sleep(3)
        page.screenshot(path="shots/resend_domains_init.png")

        # Check if vibcoders.com already exists
        domain_exists = False
        rows = page.locator("tr").all()
        for row in rows:
            if "vibcoders.com" in row.inner_text():
                domain_exists = True
                print("vibcoders.com domain already exists in Resend!")
                # Click on it to see DNS records
                row.locator("a").first.click()
                time.sleep(3)
                break

        if not domain_exists:
            print("Adding vibcoders.com domain...")
            # Click "Create Domain" or "Add Domain"
            add_btn = page.locator("button:has-text('Add Domain'), button:has-text('Create Domain'), a:has-text('Add Domain')").first
            if add_btn.count() > 0:
                add_btn.click()
                time.sleep(2)
            else:
                # If no button, might be empty state button
                empty_btn = page.locator("button:has-text('Add Domain'), button:has-text('Create Domain')").first
                empty_btn.click()
                time.sleep(2)
            
            # Fill in the domain input
            domain_input = page.locator("input[placeholder='example.com'], input[name='name'], input[type='text']").first
            domain_input.fill("vibcoders.com")
            time.sleep(1)
            
            # Click "Add" or "Create"
            submit_btn = page.locator("button[type='submit'], button:has-text('Add'), button:has-text('Save')").first
            submit_btn.click()
            time.sleep(4)

        # Take screenshot of DNS settings
        page.screenshot(path="shots/resend_dns_records.png")
        print("Captured DNS records page screenshot.")

        # Extract DNS records text
        dns_records = []
        dns_rows = page.locator("tr").all()
        print(f"Found {len(dns_rows)} rows on DNS page")
        for idx, row in enumerate(dns_rows):
            text = row.inner_text().strip().replace("\n", " | ")
            if text:
                print(f"Row {idx}: {text}")
                # Filter out headers and keep DNS records
                if "TXT" in text or "MX" in text or "CNAME" in text:
                    dns_records.append(text)

        credentials["domain"] = "vibcoders.com"
        credentials["dns_records"] = dns_records

        # 2. Go to API Keys
        print("Navigating to API Keys page...")
        page.goto("https://resend.com/api-keys", timeout=30000)
        time.sleep(3)
        page.screenshot(path="shots/resend_api_keys_init.png")

        # Click Create API Key
        create_key_btn = page.locator("button:has-text('Create API Key'), a:has-text('Create API Key')").first
        create_key_btn.click()
        time.sleep(2)

        # Fill name
        name_input = page.locator("input[placeholder='Production'], input[name='name']").first
        name_input.fill("reviews-app-prod")
        time.sleep(1)

        # Select Sending access or Full access (default is usually fine, but let's make sure it's created)
        # Click Add/Create
        add_key_btn = page.locator("button[type='submit'], button:has-text('Add'), button:has-text('Create')").first
        add_key_btn.click()
        time.sleep(3)

        page.screenshot(path="shots/resend_api_key_created.png")

        # Extract API key
        # The key is usually displayed in an input field or a code block
        key_element = page.locator("code, input[readonly], [class*='copy']").first
        api_key = ""
        if key_element.count() > 0:
            # Let's try to get value from input or text from code
            tag_name = key_element.evaluate("el => el.tagName.toLowerCase()")
            if tag_name == "input":
                api_key = key_element.input_value()
            else:
                api_key = key_element.inner_text()
        
        # Cleanup any spaces
        api_key = api_key.strip()
        print(f"Extracted API Key prefix: {api_key[:10]}...")

        credentials["api_key"] = api_key

        # Save credentials to scratch/credentials.json
        os.makedirs("scratch", exist_ok=True)
        with open("scratch/credentials.json", "w") as f:
            json.dump(credentials, f, indent=2)
        print("Saved credentials to scratch/credentials.json")

        # Save credentials to C:\Users\prabh\.gemini\antigravity\scratch\credentials.json as requested
        os.makedirs(r"C:\Users\prabh\.gemini\antigravity\scratch", exist_ok=True)
        with open(r"C:\Users\prabh\.gemini\antigravity\scratch\credentials.json", "w") as f:
            json.dump(credentials, f, indent=2)
        print(r"Saved credentials to C:\Users\prabh\.gemini\antigravity\scratch\credentials.json")

        return credentials

if __name__ == "__main__":
    configure_resend()
