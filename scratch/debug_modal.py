import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    print("Connecting to Chrome...")
    browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = browser.contexts[0]
    page = ctx.pages[0] # Resend tab should be pages[0] or we find it
    for pg in ctx.pages:
        if "resend.com" in pg.url:
            page = pg
            break
            
    page.bring_to_front()
    page.goto("https://resend.com/api-keys")
    time.sleep(3)
    
    # Click Create API Key to open modal
    create_key_btn = page.locator("button:has-text('Create API Key'), a:has-text('Create API Key')").first
    create_key_btn.click()
    time.sleep(2)
    
    # Take screenshot of the open modal
    page.screenshot(path="shots/resend_modal_debug.png")
    
    # Print all button texts
    buttons = page.locator("button").all()
    print("Buttons found on page:")
    for idx, btn in enumerate(buttons):
        try:
            print(f"  Button {idx}: Text='{btn.inner_text().strip()}', Type='{btn.get_attribute('type')}', Class='{btn.get_attribute('class')}'")
        except Exception as e:
            print(f"  Button {idx} error: {e}")
            
    # Print input elements
    inputs = page.locator("input").all()
    print("Inputs found on page:")
    for idx, inp in enumerate(inputs):
        try:
            print(f"  Input {idx}: Name='{inp.get_attribute('name')}', Placeholder='{inp.get_attribute('placeholder')}'")
        except Exception as e:
            print(f"  Input {idx} error: {e}")
