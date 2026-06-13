import os
import json

def backup():
    credentials = {
        "domain": "vibcoders.com",
        "resend_api_key": "re_idBrWYtZ_CqkZXMNTA2u35qYDpf2oXNtn",
        "resend_from_address": "reviews@vibcoders.com",
        "cloudflare_account_id": "317dee6de38fec1303a16f7070187a15",
        "cloudflare_r2_bucket": "wix-reviews-media",
        "cloudflare_r2_public_base_url": "https://media.example.com",
        "dns_records": []
    }
    
    # Load DNS records if file exists
    dns_file = "scratch/dns_records_full.json"
    if os.path.exists(dns_file):
        with open(dns_file, "r") as f:
            credentials["dns_records"] = json.load(f)
            
    # Also merge R2 credentials if they exist
    r2_file = "scratch/cf_r2_credentials.json"
    if os.path.exists(r2_file):
        with open(r2_file, "r") as f:
            r2_data = json.load(f)
            credentials["cloudflare_r2_access_key_id"] = r2_data.get("access_key_id")
            credentials["cloudflare_r2_secret_access_key"] = r2_data.get("secret_access_key")
            
    backup_dir = r"C:\Users\prabh\.gemini\antigravity\credentials"
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, "wix_portfolio_credentials.json")
    
    # Write backup
    with open(backup_path, "w") as f:
        json.dump(credentials, f, indent=2)
    print(f"Successfully saved secure credentials backup to {backup_path}")

if __name__ == "__main__":
    backup()
