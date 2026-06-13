import subprocess
import os
import time
import sys

# 1. Kill all chrome
print("Force killing all chrome.exe processes...")
subprocess.run("taskkill /F /IM chrome.exe", shell=True, capture_output=True)
time.sleep(2)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
profile_dir = r"D:\shopify\scratch\chrome-profile"
os.makedirs(profile_dir, exist_ok=True)

cmd = [
    chrome_path,
    "--remote-debugging-port=9222",
    f"--user-data-dir={profile_dir}",
    "--no-first-run",
    "--no-default-browser-check"
]

print(f"Starting Chrome daemon: {' '.join(cmd)}")
sys.stdout.flush()

proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

# Keep the daemon running
try:
    while True:
        # Check if Chrome is still running
        ret = proc.poll()
        if ret is not None:
            print(f"Chrome exited with code {ret}. Restarting...")
            sys.stdout.flush()
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        time.sleep(1)
except KeyboardInterrupt:
    print("Exiting...")
    proc.terminate()
