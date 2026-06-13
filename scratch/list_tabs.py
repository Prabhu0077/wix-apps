from playwright.sync_api import sync_playwright

try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        print("Contexts count:", len(browser.contexts))
        for c_idx, ctx in enumerate(browser.contexts):
            print(f"Context {c_idx}: {len(ctx.pages)} pages")
            for p_idx, pg in enumerate(ctx.pages):
                try:
                    print(f"  Page {p_idx}: {pg.url} - '{pg.title()}'")
                except Exception as e:
                    print(f"  Page {p_idx}: {pg.url} - Error: {e}")
except Exception as e:
    print("Failed to connect to Chrome:", e)
