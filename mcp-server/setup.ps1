# VAN MCP Server Setup
# Run this once after cloning the branch.
# Right-click this file and choose "Run with PowerShell"

Set-StrictMode -Off
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VAN MCP Server Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Repo root ────────────────────────────────────────────────────────────────
# $PSScriptRoot is empty when right-clicked; fall back to $MyInvocation
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot  = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot
Write-Host "Repo root: $RepoRoot" -ForegroundColor DarkGray

# ── 1. Find Node.js (v18+) ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Checking for Node.js..." -ForegroundColor Yellow

$NodePath = $null

# Try nvm-managed versions first
$NvmDir = "$env:APPDATA\nvm"
if (Test-Path $NvmDir) {
    $nvmVersions = Get-ChildItem $NvmDir -Directory |
        Where-Object { $_.Name -match '^v(\d+)\.' } |
        Sort-Object { [int]($_.Name -replace '^v(\d+)\..*', '$1') } -Descending
    foreach ($v in $nvmVersions) {
        $major = [int]($v.Name -replace '^v(\d+)\..*', '$1')
        $candidate = "$($v.FullName)\node.exe"
        if ($major -ge 18 -and (Test-Path $candidate)) {
            $NodePath = $candidate
            break
        }
    }
}

# Fall back to system node — verify it is v18+
if (-not $NodePath) {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $systemNode) {
        $rawVer = & $systemNode.Source --version 2>$null
        $major  = [int]($rawVer -replace '^v(\d+)\..*', '$1')
        if ($major -ge 18) { $NodePath = $systemNode.Source }
    }
}

if (-not $NodePath) {
    Write-Host ""
    Write-Host "ERROR: Node.js v18 or higher was not found." -ForegroundColor Red
    Write-Host "Download and install it from https://nodejs.org, then re-run this script." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$NodeVersion = & $NodePath --version 2>$null
Write-Host "  Found Node $NodeVersion" -ForegroundColor Green
Write-Host "  Path: $NodePath" -ForegroundColor DarkGray

# ── 2. Locate npm beside the found node ──────────────────────────────────────
$NodeDir = Split-Path -Parent $NodePath
$NpmCmd  = "$NodeDir\npm.cmd"
if (-not (Test-Path $NpmCmd)) { $NpmCmd = "$NodeDir\npm" }
if (-not (Test-Path $NpmCmd)) {
    # Last resort: npm on PATH
    $npmOnPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -ne $npmOnPath) { $NpmCmd = $npmOnPath.Source } else { $NpmCmd = "npm" }
}
Write-Host "  npm: $NpmCmd" -ForegroundColor DarkGray

# ── 3. Install dependencies & build ──────────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
& $NpmCmd install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

Write-Host "Building..." -ForegroundColor Yellow
& $NpmCmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: build failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

Write-Host "Installing CLI globally..." -ForegroundColor Yellow
& $NpmCmd install -g .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: global install failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

Write-Host "  Done." -ForegroundColor Green

# ── 4. Prompt for VAN API URL ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Enter the VAN API base URL." -ForegroundColor Yellow
Write-Host "  (Ask your VAN administrator if you are unsure)" -ForegroundColor DarkGray
Write-Host ""
$LoginUrl = (Read-Host "VAN API URL").Trim()

while ([string]::IsNullOrWhiteSpace($LoginUrl) -or -not $LoginUrl.StartsWith("https://")) {
    Write-Host "  Please enter a valid URL starting with https://" -ForegroundColor Red
    $LoginUrl = (Read-Host "VAN API URL").Trim()
}

[System.Environment]::SetEnvironmentVariable("DEFAULT_LOGIN_URL", $LoginUrl, "User")
$env:DEFAULT_LOGIN_URL = $LoginUrl
Write-Host "  Set to $LoginUrl" -ForegroundColor Green

# ── 5. Configure Cowork (Claude Desktop) ─────────────────────────────────────
Write-Host ""
Write-Host "Configuring Cowork (Claude Desktop)..." -ForegroundColor Yellow

# Claude Desktop can be installed as a traditional app or from the Windows Store.
# The Store version uses a sandboxed LocalCache path with a dynamic package name.
$ConfigPathStandard = "$env:APPDATA\Claude\claude_desktop_config.json"
$ConfigPath = $ConfigPathStandard

$ClaudePackage = Get-ChildItem "$env:LOCALAPPDATA\Packages" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'Claude_*' } |
    Select-Object -First 1

if ($null -ne $ClaudePackage) {
    $ConfigPath = "$($ClaudePackage.FullName)\LocalCache\Roaming\Claude\claude_desktop_config.json"
}
$TsxPath       = "$RepoRoot\node_modules\tsx\dist\cli.mjs"
$IndexPath     = "$RepoRoot\mcp-server\src\index.ts"
$NodePathJson  = $NodePath -replace '/', '\'
$TsxPathJson   = $TsxPath  -replace '/', '\'
$IndexPathJson = $IndexPath -replace '/', '\'

$TlsRejectValue = if ($LoginUrl -match "securevan\.com$") { "1" } else { "0" }

# Escape backslashes for JSON (\ -> \\)
$NodeEsc  = $NodePathJson.Replace('\', '\\')
$TsxEsc   = $TsxPathJson.Replace('\', '\\')
$IndexEsc = $IndexPathJson.Replace('\', '\\')

# Build the van server block as a valid JSON string
$VanBlock = "{`"command`":`"$NodeEsc`",`"args`":[`"$TsxEsc`",`"$IndexEsc`"],`"env`":{`"DEFAULT_LOGIN_URL`":`"$LoginUrl`",`"NODE_TLS_REJECT_UNAUTHORIZED`":`"$TlsRejectValue`"}}"

if (Test-Path $ConfigPath) {
    $raw = [System.IO.File]::ReadAllText($ConfigPath)

    if ($raw -match '"mcpServers"') {
        if ($raw -match '"van"') {
            # van block already exists — find and replace it using index arithmetic
            $start = $raw.IndexOf('"van"')
            $brace = $raw.IndexOf('{', $start)
            # Walk forward counting braces to find the matching closing brace
            $depth = 0; $end = $brace
            for ($i = $brace; $i -lt $raw.Length; $i++) {
                if ($raw[$i] -eq '{') { $depth++ }
                elseif ($raw[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end = $i; break } }
            }
            $raw = $raw.Substring(0, $start) + """van"": $VanBlock" + $raw.Substring($end + 1)
        } else {
            # Insert van as the first entry inside mcpServers
            $idx = $raw.IndexOf('"mcpServers"')
            $brace = $raw.IndexOf('{', $idx)
            $raw = $raw.Substring(0, $brace + 1) + "`n    ""van"": $VanBlock," + $raw.Substring($brace + 1)
        }
    } else {
        # No mcpServers at all — insert before the final closing brace
        $lastBrace = $raw.LastIndexOf('}')
        $raw = $raw.Substring(0, $lastBrace).TrimEnd() + ",`n  ""mcpServers"": {`n    ""van"": $VanBlock`n  }`n}"
    }

    [System.IO.File]::WriteAllText($ConfigPath, $raw, (New-Object System.Text.UTF8Encoding $false))
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null
    $newConfig = "{`"mcpServers`":{`"van`":$VanBlock}}"
    [System.IO.File]::WriteAllText($ConfigPath, $newConfig, (New-Object System.Text.UTF8Encoding $false))
}

Write-Host "  Written to $ConfigPath" -ForegroundColor Green

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Restart Claude Desktop (Cowork)" -ForegroundColor White
Write-Host "  2. Ask Claude: 'Log me in to VAN'" -ForegroundColor White
Write-Host "  3. Complete the browser login when it opens" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
