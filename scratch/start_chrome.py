import subprocess
import os

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
profile_dir = r"D:\shopify\scratch\chrome-profile"
os.makedirs(profile_dir, exist_ok=True)

cmd_str = f'"{chrome_path}" --remote-debugging-port=9222 --user-data-dir="{profile_dir}" --no-first-run --no-default-browser-check'

print(f"Launching Chrome with string: {cmd_str}")
proc = subprocess.Popen(cmd_str, creationflags=subprocess.CREATE_NEW_CONSOLE)
print(f"Launched. PID: {proc.pid}")
