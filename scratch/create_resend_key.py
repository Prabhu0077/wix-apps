import time
from playwright.sync_api import sync_playwright

def create_key():
    with sync_playwright() as p:
        print("Connecting to Chrome...")
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = browser.contexts[0]
        
        # Find or create resend page
        page = None
        for pg in ctx.pages:
            if "resend.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.new_page()
            
        page.bring_to_front()
        print("Navigating to https://resend.com/api-keys ...")
        page.goto("https://resend.com/api-keys")
        time.sleep(3)
        
        # Click Create API Key button
        print("Clicking Create API Key...")
        create_btn = page.locator("button:has-text('Create API key')").first
        create_btn.click()
        time.sleep(2)
        
        # Fill in the name
        print("Filling in name...")
        name_input = page.locator("input[name='name']")
        name_input.fill("reviews-app-prod")
        time.sleep(1)
        
        # Click Add submit button
        print("Clicking submit (Add)...")
        # Since we saw only one submit button "Add\nCtrl\n↩" in the modal:
        submit_btn = page.locator("button[type='submit']").first
        submit_btn.click()
        time.sleep(5)
        
        # Take screenshot of key creation outcome
        page.screenshot(path="shots/resend_key_created_success.png")
        print("Saved screenshot to shots/resend_key_created_success.png")
        
        # Let's inspect the page content to find the API key
        print("Searching for API key in inputs and code elements...")
        
        # Check inputs (sometimes read-only inputs contain it)
        inputs = page.locator("input").all()
        for idx, inp in enumerate(inputs):
            try:
                val = inp.input_value()
                placeholder = inp.get_attribute("placeholder")
                print(f"Input {idx}: placeholder='{placeholder}', value='{val}'")
                if val.startswith("re_"):
                    print(f"FOUND API KEY in Input: {val}")
                    with open("scratch/temp_resend_key.txt", "w") as f:
                        f.write(val)
                    return
            except Exception as e:
                pass
                
        # Check code / pre elements
        code_elements = page.locator("code, pre, span").all()
        for idx, el in enumerate(code_elements):
            try:
                text = el.inner_text().strip()
                if text.startswith("re_"):
                    print(f"FOUND API KEY in element: {text}")
                    with open("scratch/temp_resend_key.txt", "w") as f:
                        f.write(text)
                    return
            except Exception as e:
                pass
                
        # Try checking entire body text for pattern match re_[a-zA-Z0-9]{36} or similar
        body_text = page.locator("body").inner_text()
        import re
        matches = re.findall(r"re_[a-zA-Z0-9_]+", body_text)
        if matches:
            print(f"FOUND API KEY via Regex in body text: {matches[0]}")
            with open("scratch/temp_resend_key.txt", "w") as f:
                f.write(matches[0])
            return
            
        print("Could not find API key. Please check the screenshot shots/resend_key_created_success.png")

if __name__ == "__main__":
    create_key()
