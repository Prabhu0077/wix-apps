import os

def list_all_src():
    root_dir = "apps/reviews"
    for dirpath, dirnames, filenames in os.walk(root_dir):
        if any(ignored in dirpath for ignored in ["node_modules", ".next", ".turbo"]):
            continue
        for filename in filenames:
            # Show only source/config files
            if filename.endswith((".ts", ".tsx", ".json", ".js", ".jsx", ".md", ".css")):
                filepath = os.path.join(dirpath, filename)
                print(filepath)

if __name__ == "__main__":
    list_all_src()
