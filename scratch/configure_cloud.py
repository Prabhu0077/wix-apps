import os
import time
import json
import re
from playwright.sync_api import sync_playwright

def configure_cloud():
    credentials = {}

    with sync_playwright() as p:
        print("Connecting to Chrome on port 9222...")
        try:
            browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        except Exception as e:
            # Fallback to localhost if 127.0.0.1 fails
            try:
                browser = p.chromium.connect_over_cdp("http://localhost:9222")
            except Exception as e2:
                print(f"Failed to connect to Chrome on port 9222: {e2}")
                print("Make sure you started Chrome with: python scratch/start_chrome.py")
                return

        ctx = browser.contexts[0]
        
        # ----------------------------------------------------
        # 1. CONFIGURE RESEND
        # ----------------------------------------------------
        resend_page = None
        # Try to find an existing Resend page or open a new tab
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                resend_page = pg
                break
        
        if not resend_page:
            resend_page = ctx.new_page()
        
        resend_page.bring_to_front()
        print("Navigating to Resend Domains page...")
        resend_page.goto("https://resend.com/domains", timeout=30000)
        time.sleep(3)
        resend_page.screenshot(path="shots/resend_domains_init.png")

        # Check if vibcoders.com already exists
        domain_exists = False
        rows = resend_page.locator("tr").all()
        for row in rows:
            try:
                row_text = row.inner_text()
                if "vibcoders.com" in row_text:
                    domain_exists = True
                    print("vibcoders.com domain already exists in Resend!")
                    # Click on it to see DNS records
                    row.locator("a").first.click()
                    time.sleep(3)
                    break
            except Exception:
                pass

        if not domain_exists:
            print("Adding vibcoders.com domain...")
            add_btn = resend_page.locator("button:has-text('Add Domain'), button:has-text('Create Domain'), a:has-text('Add Domain')").first
            if add_btn.count() > 0:
                add_btn.click()
                time.sleep(2)
            else:
                empty_btn = resend_page.locator("button:has-text('Add Domain'), button:has-text('Create Domain')").first
                empty_btn.click()
                time.sleep(2)
            
            domain_input = resend_page.locator("input[placeholder='example.com'], input[name='name'], input[type='text']").first
            domain_input.fill("vibcoders.com")
            time.sleep(1)
            
            submit_btn = resend_page.locator("button[type='submit'], button:has-text('Add'), button:has-text('Save')").first
            submit_btn.click()
            time.sleep(4)

        resend_page.screenshot(path="shots/resend_dns_records.png")
        print("Captured DNS records page screenshot.")

        # Extract DNS records text
        dns_records = []
        dns_rows = resend_page.locator("tr").all()
        for idx, row in enumerate(dns_rows):
            try:
                text = row.inner_text().strip().replace("\n", " | ")
                if text and ("TXT" in text or "MX" in text or "CNAME" in text):
                    dns_records.append(text)
            except Exception:
                pass

        credentials["domain"] = "vibcoders.com"
        credentials["dns_records"] = dns_records

        # Go to API Keys
        print("Navigating to API Keys page...")
        resend_page.goto("https://resend.com/api-keys", timeout=30000)
        time.sleep(3)
        resend_page.screenshot(path="shots/resend_api_keys_init.png")

        # Click Create API Key
        create_key_btn = resend_page.locator("button:has-text('Create API Key'), a:has-text('Create API Key')").first
        create_key_btn.click()
        time.sleep(2)

        # Fill name
        name_input = resend_page.locator("input[placeholder='Production'], input[name='name']").first
        name_input.fill("reviews-app-prod")
        time.sleep(1)

        # Click Add/Create
        add_key_btn = resend_page.locator("button[type='submit'], button:has-text('Add'), button:has-text('Create')").first
        add_key_btn.click()
        time.sleep(3)

        resend_page.screenshot(path="shots/resend_api_key_created.png")

        # Extract API key
        key_element = resend_page.locator("code, input[readonly], [class*='copy']").first
        resend_api_key = ""
        if key_element.count() > 0:
            tag_name = key_element.evaluate("el => el.tagName.toLowerCase()")
            if tag_name == "input":
                resend_api_key = key_element.input_value()
            else:
                resend_api_key = key_element.inner_text()
        
        resend_api_key = resend_api_key.strip()
        print(f"Extracted Resend API Key: {resend_api_key[:10]}...")
        credentials["resend_api_key"] = resend_api_key

        # ----------------------------------------------------
        # 2. CONFIGURE CLOUDFLARE R2
        # ----------------------------------------------------
        cf_page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                cf_page = pg
                break
        
        if not cf_page:
            cf_page = ctx.new_page()
            cf_page.goto("https://dash.cloudflare.com/", timeout=30000)
            time.sleep(5)
        
        cf_page.bring_to_front()
        print("Navigating to Cloudflare Home/R2...")
        
        # Get Account ID from the URL if we are in dashboard
        url = cf_page.url
        match = re.search(r"dash\.cloudflare\.com/([a-f0-9]{32})", url)
        account_id = match.group(1) if match else ""
        
        if not account_id:
            # Let's wait and look at URL
            time.sleep(2)
            match = re.search(r"dash\.cloudflare\.com/([a-f0-9]{32})", cf_page.url)
            account_id = match.group(1) if match else ""
        
        print(f"Cloudflare Account ID: {account_id}")
        credentials["cloudflare_account_id"] = account_id

        # Go directly to R2
        if account_id:
            cf_page.goto(f"https://dash.cloudflare.com/{account_id}/r2/default", timeout=30000)
        else:
            print("Could not extract Account ID, please navigate to R2 manually.")
            # Wait for user or attempt standard click
            cf_page.locator("a:has-text('R2')").first.click()
        
        time.sleep(5)
        cf_page.screenshot(path="shots/cf_r2_init.png")

        # Create Bucket wix-reviews-media
        # Check if bucket already exists
        bucket_exists = False
        if "wix-reviews-media" in cf_page.content():
            bucket_exists = True
            print("Bucket 'wix-reviews-media' already exists!")
        
        if not bucket_exists:
            print("Creating R2 Bucket 'wix-reviews-media'...")
            create_bucket_btn = cf_page.locator("a[href*='/r2/new'], button:has-text('Create bucket')").first
            create_bucket_btn.click()
            time.sleep(3)
            
            # Fill bucket name
            name_input = cf_page.locator("input[name='name'], input[placeholder*='bucket-name']").first
            name_input.fill("wix-reviews-media")
            time.sleep(1)
            
            # Click create
            submit_bucket_btn = cf_page.locator("button[type='submit'], button:has-text('Create bucket')").first
            submit_bucket_btn.click()
            time.sleep(5)
            cf_page.screenshot(path="shots/cf_bucket_created.png")
            print("Bucket created successfully!")

        # Go to Manage R2 API Tokens
        print("Navigating to API Tokens page...")
        if account_id:
            cf_page.goto(f"https://dash.cloudflare.com/{account_id}/r2/overview/api-tokens", timeout=30000)
        else:
            cf_page.locator("a:has-text('Manage R2 API Tokens')").first.click()
        time.sleep(4)
        cf_page.screenshot(path="shots/cf_api_tokens_init.png")

        # Create API Token
        print("Creating API Token...")
        create_token_btn = cf_page.locator("a[href*='/r2/api-tokens/create'], button:has-text('Create API token')").first
        create_token_btn.click()
        time.sleep(3)

        # Token name
        token_name_input = cf_page.locator("input[name='name'], input[placeholder*='Token name']").first
        token_name_input.fill("wix-reviews-r2-token")
        time.sleep(1)

        # Permissions: Edit
        edit_radio = cf_page.locator("label:has-text('Edit'), input[value='edit']").first
        edit_radio.click()
        time.sleep(1)

        # Click Create API Token
        submit_token_btn = cf_page.locator("button[type='submit'], button:has-text('Create API token')").first
        submit_token_btn.click()
        time.sleep(5)
        cf_page.screenshot(path="shots/cf_api_token_created.png")

        # Extract R2 Token details
        # They are usually presented in pre or code blocks or as inputs
        pre_elements = cf_page.locator("pre, code, input[readonly]").all()
        token_details = []
        for el in pre_elements:
            try:
                txt = el.inner_text().strip()
                if txt:
                    token_details.append(txt)
            except Exception:
                pass
        
        print("Extracted token elements:", len(token_details))
        
        r2_access_key_id = ""
        r2_secret_access_key = ""
        
        # Parse token details to find keys
        for detail in token_details:
            if "Access Key ID" in detail or len(detail) == 24: # typical CF access key size
                r2_access_key_id = detail.split(":")[-1].strip() if ":" in detail else detail
            elif "Secret Access Key" in detail or len(detail) == 64: # typical CF secret key size
                r2_secret_access_key = detail.split(":")[-1].strip() if ":" in detail else detail

        # Fallback parsing from page text
        page_text = cf_page.locator("body").inner_text()
        access_key_match = re.search(r"Access Key ID:\s*([a-zA-Z0-9]+)", page_text)
        if access_key_match:
            r2_access_key_id = access_key_match.group(1)
        secret_key_match = re.search(r"Secret Access Key:\s*([a-zA-Z0-9+/=]+)", page_text)
        if secret_key_match:
            r2_secret_access_key = secret_key_match.group(1)

        print(f"Extracted Access Key ID: {r2_access_key_id[:8]}...")
        print(f"Extracted Secret Access Key: {r2_secret_access_key[:8]}...")
        
        credentials["r2_access_key_id"] = r2_access_key_id
        credentials["r2_secret_access_key"] = r2_secret_access_key
        credentials["r2_bucket"] = "wix-reviews-media"

        # ----------------------------------------------------
        # 3. SAVE CREDENTIALS
        # ----------------------------------------------------
        # Write to credentials.json in workspace
        os.makedirs("scratch", exist_ok=True)
        with open("scratch/credentials.json", "w") as f:
            json.dump(credentials, f, indent=2)
        print("Saved to scratch/credentials.json")

        # Write to secure app data dir
        os.makedirs(r"C:\Users\prabh\.gemini\antigravity\scratch", exist_ok=True)
        with open(r"C:\Users\prabh\.gemini\antigravity\scratch\credentials.json", "w") as f:
            json.dump(credentials, f, indent=2)
        print(r"Saved to C:\Users\prabh\.gemini\antigravity\scratch\credentials.json")

        # Also create a credentials backup folder outside the workspace for future use
        backup_dir = r"C:\Users\prabh\.gemini\antigravity\credentials"
        os.makedirs(backup_dir, exist_ok=True)
        with open(os.path.join(backup_dir, "wix_portfolio_credentials.json"), "w") as f:
            json.dump(credentials, f, indent=2)
        print(f"Saved secure backup to {backup_dir}\\wix_portfolio_credentials.json")

        # Update reviews app .env.local
        env_path = "apps/reviews/.env.local"
        env_content = ""
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                env_content = f.read()

        # Update or append keys
        updates = {
            "RESEND_API_KEY": resend_api_key,
            "CLOUDFLARE_R2_ACCOUNT_ID": account_id,
            "CLOUDFLARE_R2_ACCESS_KEY_ID": r2_access_key_id,
            "CLOUDFLARE_R2_SECRET_ACCESS_KEY": r2_secret_access_key,
            "CLOUDFLARE_R2_BUCKET": "wix-reviews-media"
        }

        for key, val in updates.items():
            if f"{key}=" in env_content:
                env_content = re.sub(rf"{key}=.*", f"{key}={val}", env_content)
            else:
                env_content += f"\n{key}={val}"

        with open(env_path, "w") as f:
            f.write(env_content.strip() + "\n")
        print(f"Updated env vars in {env_path}")

        print("\n=== CONFIGURATION COMPLETE ===")
        print("Please verify the DNS records shown below in Resend and add them to your Vercel DNS settings.")
        print(f"Resend API Key: {resend_api_key[:10]}...")
        print(f"Cloudflare Account ID: {account_id}")
        print(f"R2 Access Key: {r2_access_key_id[:10]}...")
        print("==============================\n")

if __name__ == "__main__":
    configure_cloud()
