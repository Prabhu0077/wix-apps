import os

def search_files():
    root_dir = "apps/reviews"
    matches = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Ignore node_modules, .next, and .turbo
        if any(ignored in dirpath for ignored in ["node_modules", ".next", ".turbo"]):
            continue
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "postmark" in content.lower():
                        matches.append(filepath)
            except Exception:
                pass
    print("Files referencing Postmark:")
    for match in matches:
        print(f"  {match}")

if __name__ == "__main__":
    search_files()
