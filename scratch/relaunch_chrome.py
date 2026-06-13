import subprocess
import os
import time

# 1. Kill chrome
print("Killing all running Chrome instances...")
subprocess.run("taskkill /F /IM chrome.exe", shell=True, capture_output=True)
time.sleep(2)

# 2. Launch chrome
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
profile_dir = r"D:\shopify\scratch\chrome-profile"
os.makedirs(profile_dir, exist_ok=True)

cmd_str = f'"{chrome_path}" --remote-debugging-port=9222 --user-data-dir="{profile_dir}" --no-first-run --no-default-browser-check'
print(f"Launching Chrome: {cmd_str}")
proc = subprocess.Popen(cmd_str, creationflags=subprocess.CREATE_NEW_CONSOLE)
print(f"Launched with PID: {proc.pid}")
time.sleep(3)

# 3. Check port 9222
from playwright.sync_api import sync_playwright
try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        print("Successfully connected to Chrome on port 9222!")
        print("Open pages:")
        for ctx in browser.contexts:
            for pg in ctx.pages:
                print(f"  {pg.url} - '{pg.title()}'")
except Exception as e:
    print(f"Connection check failed: {e}")
