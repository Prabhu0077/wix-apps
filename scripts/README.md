# scripts/

Operational helpers for the Wix Apps monorepo.

## `sync-docs.ps1`

Mirrors `D:\wix\docs\` to a second local folder — typically a Google Drive synced folder — so the strategy and spec files exist in two physical locations. This is portability + backup, not a sync engine; re-run whenever you change docs.

### How it picks the target

In priority order:

1. The `-Target` argument: `pwsh -File ./scripts/sync-docs.ps1 -Target "G:\My Drive\wix-strategy"`
2. The `WIX_DOCS_MIRROR` environment variable.
3. The first candidate path in `$DefaultTargets` (inside the script) whose **parent folder** exists. The defaults try common Google Drive paths first, then fall back to `%USERPROFILE%\Documents\wix-strategy-mirror`.

If none of those work, the script exits with a clear error telling you what to pass.

### Usage

```powershell
# From the repo root:
pnpm sync-docs

# Or directly:
pwsh -File ./scripts/sync-docs.ps1
pwsh -File ./scripts/sync-docs.ps1 -Target "G:\My Drive\wix-strategy"
pwsh -File ./scripts/sync-docs.ps1 -DryRun
```

### What gets copied

Everything in `docs/` (the `.docx` and all `.md` files), excluding Office lock files (`~$*.docx`, etc.). Files at the target that are newer than the source are skipped.

### To configure permanently

Either:

- Edit the `$DefaultTargets` list at the top of `sync-docs.ps1` to put your real Google Drive path first, or
- Set a user-level env var:
  ```powershell
  [Environment]::SetEnvironmentVariable("WIX_DOCS_MIRROR", "G:\My Drive\wix-strategy", "User")
  ```

After either change, future `pnpm sync-docs` runs need no arguments.
