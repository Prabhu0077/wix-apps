# scripts/sync-docs.ps1
#
# Mirrors D:\wix\docs\ to a second local location (typically a Google Drive
# synced folder) so the strategy docs exist in two places. This is a portable
# backup, not a sync engine — re-run after meaningful changes.
#
# Usage (from repo root):
#   pwsh -File ./scripts/sync-docs.ps1
#   pwsh -File ./scripts/sync-docs.ps1 -Target "G:\My Drive\wix-strategy"
#   pwsh -File ./scripts/sync-docs.ps1 -DryRun
#
# Or via the workspace shortcut:
#   pnpm sync-docs

[CmdletBinding()]
param(
  # Where to mirror to. Override with -Target or by editing $DefaultTarget below.
  [string]$Target = $env:WIX_DOCS_MIRROR,

  # Preview what would be copied without writing anything.
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source   = Join-Path $RepoRoot "docs"

# --- Default target candidates (first one that exists wins) ---
# Edit this list if your Google Drive is elsewhere.
$DefaultTargets = @(
  "G:\My Drive\wix-strategy",
  "H:\My Drive\wix-strategy",
  (Join-Path $env:USERPROFILE "Google Drive\wix-strategy"),
  (Join-Path $env:USERPROFILE "GoogleDrive\wix-strategy"),
  (Join-Path $env:USERPROFILE "Documents\wix-strategy-mirror")  # safe fallback
)

if (-not $Target) {
  foreach ($candidate in $DefaultTargets) {
    $parent = Split-Path -Parent $candidate
    if (Test-Path $parent) {
      $Target = $candidate
      break
    }
  }
}

if (-not $Target) {
  Write-Error "Could not find a default mirror target. Pass -Target 'X:\path\to\folder' or set WIX_DOCS_MIRROR env var."
  exit 1
}

if (-not (Test-Path $Source)) {
  Write-Error "Source folder not found: $Source"
  exit 1
}

Write-Host "Source : $Source"
Write-Host "Target : $Target"
Write-Host "DryRun : $DryRun"
Write-Host ""

if (-not $DryRun -and -not (Test-Path $Target)) {
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
  Write-Host "Created target folder."
}

# --- File list: everything in docs/ except temporary lock files ---
$files = Get-ChildItem -Path $Source -File | Where-Object { $_.Name -notlike "~$*" }

$copied  = 0
$skipped = 0

foreach ($file in $files) {
  $dest = Join-Path $Target $file.Name
  $shouldCopy = $true

  if (Test-Path $dest) {
    $srcTime = $file.LastWriteTimeUtc
    $dstTime = (Get-Item $dest).LastWriteTimeUtc
    if ($srcTime -le $dstTime) {
      $shouldCopy = $false
    }
  }

  if ($shouldCopy) {
    if ($DryRun) {
      Write-Host "WOULD COPY  $($file.Name)"
    } else {
      Copy-Item -Path $file.FullName -Destination $dest -Force
      Write-Host "COPIED      $($file.Name)"
    }
    $copied++
  } else {
    Write-Host "SKIP (newer at target)  $($file.Name)"
    $skipped++
  }
}

Write-Host ""
Write-Host "Done. $copied $(if ($DryRun) {'would be '})copied, $skipped skipped."
