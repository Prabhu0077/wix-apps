import time
import re
import json
from playwright.sync_api import sync_playwright

ACCOUNT_ID = "317dee6de38fec1303a16f7070187a15"

def run_cf_setup():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        page = None
        for pg in ctx.pages:
            if "cloudflare.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()
            
        page.bring_to_front()
        
        # 1. CREATE R2 BUCKET
        print(f"Navigating to R2 dashboard: https://dash.cloudflare.com/{ACCOUNT_ID}/r2/default")
        page.goto(f"https://dash.cloudflare.com/{ACCOUNT_ID}/r2/default")
        time.sleep(5)
        page.screenshot(path="shots/cf_r2_dashboard.png")
        
        bucket_name = "wix-reviews-media"
        # Check if bucket exists
        content = page.content()
        if bucket_name in content:
            print(f"R2 Bucket '{bucket_name}' already exists.")
        else:
            print(f"Creating R2 Bucket '{bucket_name}'...")
            create_btn = page.locator("a[href*='/r2/new'], button:has-text('Create bucket')").first
            create_btn.click()
            time.sleep(3)
            
            # Fill bucket name
            name_input = page.locator("input[name='name'], input[placeholder*='bucket-name']").first
            name_input.fill(bucket_name)
            time.sleep(1)
            
            # Click submit/create bucket
            submit_btn = page.locator("button[type='submit'], button:has-text('Create bucket')").first
            submit_btn.click()
            time.sleep(5)
            page.screenshot(path="shots/cf_bucket_creation_result.png")
            print("R2 Bucket creation step completed.")

        # 2. CREATE R2 API TOKEN
        print(f"Navigating to R2 API Tokens: https://dash.cloudflare.com/{ACCOUNT_ID}/r2/overview/api-tokens")
        page.goto(f"https://dash.cloudflare.com/{ACCOUNT_ID}/r2/overview/api-tokens")
        time.sleep(4)
        page.screenshot(path="shots/cf_api_tokens_list.png")
        
        print("Clicking Create API token...")
        create_token_btn = page.locator("a[href*='/r2/api-tokens/create'], button:has-text('Create API token')").first
        create_token_btn.click()
        time.sleep(4)
        page.screenshot(path="shots/cf_api_tokens_creation_form.png")
        
        # Log elements to debug fields
        inputs = page.locator("input").all()
        print("API Token page inputs:")
        for idx, inp in enumerate(inputs):
            try:
                print(f"  Input {idx}: name='{inp.get_attribute('name')}', type='{inp.get_attribute('type')}', id='{inp.get_attribute('id')}', value='{inp.get_attribute('value')}'")
            except Exception as e:
                print(f"  Input {idx} error: {e}")
                
        labels = page.locator("label").all()
        print("API Token page labels:")
        for idx, lbl in enumerate(labels):
            try:
                print(f"  Label {idx}: text='{lbl.inner_text().strip()}', for='{lbl.get_attribute('for')}'")
            except Exception as e:
                print(f"  Label {idx} error: {e}")
                
        # Fill Token name
        token_name = "wix-reviews-r2-token"
        token_name_input = page.locator("input[name='name'], input[placeholder*='Token name']").first
        token_name_input.fill(token_name)
        time.sleep(1)
        
        # We need to choose the "Edit" permission.
        # Let's find the label or input for Edit. Usually it is a radio button.
        # Let's search for an input with value="edit" or label containing "Edit" (specifically write permission)
        # Looking at R2 API Token creation, the options are:
        # - Read-only (Read)
        # - Admin Read & Write (Edit)
        # - Read & Write (Object Level)
        # Let's click the label containing "Edit" or "Admin Read & Write"
        edit_option = page.locator("label:has-text('Edit'), label:has-text('Admin Read & Write'), input[value='edit']").first
        if edit_option.count() > 0:
            print("Clicking Edit permission option...")
            edit_option.click()
        else:
            print("Could not find Edit option directly. Trying to click based on text matches.")
            # Fallback: click element containing "Edit"
            page.locator("text=Edit").first.click()
        time.sleep(1)
        
        # Click Create API Token submit button
        print("Submitting Token creation form...")
        submit_token_btn = page.locator("button[type='submit'], button:has-text('Create API token')").first
        submit_token_btn.click()
        time.sleep(5)
        page.screenshot(path="shots/cf_api_token_credentials_page.png")
        print("Saved credentials page screenshot to shots/cf_api_token_credentials_page.png")
        
        # Extract credentials
        print("Extracting credentials from page...")
        
        # R2 credentials are shown as:
        # Access Key ID: <id>
        # Secret Access Key: <key>
        # Token: <token>
        # Let's inspect pre/code/input elements
        pre_elements = page.locator("pre, code, input[readonly]").all()
        token_details = []
        for el in pre_elements:
            try:
                txt = el.inner_text().strip()
                if txt:
                    token_details.append(txt)
            except Exception:
                pass
        
        print("Extracted elements:")
        for idx, detail in enumerate(token_details):
            print(f"  Element {idx}: {detail[:50]}...")
            
        r2_access_key_id = ""
        r2_secret_access_key = ""
        
        # Match using regex on body text for absolute correctness
        body_text = page.locator("body").inner_text()
        print("Body text snippet:")
        print(body_text[:1500])
        
        access_key_match = re.search(r"Access Key ID:\s*([a-zA-Z0-9]+)", body_text)
        if access_key_match:
            r2_access_key_id = access_key_match.group(1)
            
        secret_key_match = re.search(r"Secret Access Key:\s*([a-zA-Z0-9+/=]+)", body_text)
        if secret_key_match:
            r2_secret_access_key = secret_key_match.group(1)
            
        # Also check read-only inputs or table cells if regex fails
        if not r2_access_key_id or not r2_secret_access_key:
            print("Regex fallback: searching read-only inputs and copy buttons")
            # Let's find copy buttons or elements containing the keys
            copy_elements = page.locator("[role='button'][aria-label^='Copy']").all()
            for el in copy_elements:
                aria = el.get_attribute("aria-label")
                if aria and aria.startswith("Copy "):
                    val = aria[5:]
                    if len(val) == 24: # Access key ID length
                        r2_access_key_id = val
                    elif len(val) == 64: # Secret Access Key length
                        r2_secret_access_key = val
                        
        print(f"RESULT: Access Key ID = '{r2_access_key_id}', Secret Key = '{r2_secret_access_key[:8]}...'")
        
        if r2_access_key_id and r2_secret_access_key:
            results = {
                "account_id": ACCOUNT_ID,
                "access_key_id": r2_access_key_id,
                "secret_access_key": r2_secret_access_key,
                "bucket": bucket_name
            }
            with open("scratch/cf_r2_credentials.json", "w") as f:
                json.dump(results, f, indent=2)
            print("Successfully saved R2 credentials to scratch/cf_r2_credentials.json")
        else:
            print("ERROR: Failed to extract R2 credentials!")

if __name__ == "__main__":
    run_cf_setup()
