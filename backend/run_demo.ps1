<#
  EU Youth Buddy - one-command demo backend (Phase 7 hardening).

  Boots the FastAPI backend bound to the LAN, sets up the USB-tethered phone, and PRE-WARMS the
  RAG vector DB with the rehearsed questions so the first live query on stage isn't a cold start.
  Profiles start BLANK and fill from a scanned ID — pass -SeedProfile only if you want to inject
  a fake test profile instead of scanning. Run this from a terminal before the demo:

      backend\run_demo.ps1                # boot + pre-warm (profile stays blank / from scan)
      backend\run_demo.ps1 -SeedProfile   # also inject a fake test profile (no real scan needed)
      backend\run_demo.ps1 -NoAdb         # skip `adb reverse` (use the LAN IP path instead)

  Stop the server with Ctrl+C, or: Stop-Process -Id <pid printed below>.
#>
param(
  [switch]$NoAdb,        # skip adb reverse (untethered / LAN-IP demo)
  [switch]$SeedProfile   # inject a fake test profile instead of scanning a real ID
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path   # ...\backend
Set-Location $root

# --- venv python -------------------------------------------------------------
$py = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Host "No venv at $py" -ForegroundColor Red
  Write-Host "Create it first:  python -m venv .venv ;  .venv\Scripts\python.exe -m pip install -r requirements.txt"
  exit 1
}

# --- LAN IP (what the phone uses if not USB-tethered) ------------------------
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = '<your-LAN-IP>' }

Write-Host "==== EU Youth Buddy - demo backend ====" -ForegroundColor Cyan
Write-Host ("LAN IP : http://{0}:8000   (set mobile/src/config.ts BACKEND_URL to this if not USB-tethered)" -f $ip)

# --- USB-tethered phone: forward localhost:8000 to the laptop ----------------
if (-not $NoAdb) {
  try {
    & adb reverse tcp:8000 tcp:8000
    Write-Host "adb reverse set: phone localhost:8000 -> laptop:8000" -ForegroundColor Green
  } catch {
    Write-Host "adb reverse skipped (adb not found or no device). Use the LAN IP above instead." -ForegroundColor Yellow
  }
}

# --- boot uvicorn (stays running in this console) ----------------------------
Write-Host "Starting uvicorn on 0.0.0.0:8000 ..." -ForegroundColor Cyan
$server = Start-Process -FilePath $py `
  -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8000' `
  -WorkingDirectory $root -NoNewWindow -PassThru
Write-Host ("uvicorn pid = {0}  (stop with: Stop-Process -Id {0})" -f $server.Id)

# --- wait for /health --------------------------------------------------------
$healthy = $false
foreach ($i in 1..30) {
  try {
    $h = Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2
    $healthy = $true
    $keyOk = $false
    try { $keyOk = [bool]$h.openai_key } catch {}
    Write-Host ("Backend up. OpenAI key configured: {0}" -f $keyOk) -ForegroundColor Green
    if (-not $keyOk) { Write-Host "WARNING: OPENAI_API_KEY not set - voice + vision will fail. Edit backend\.env." -ForegroundColor Yellow }
    break
  } catch { Start-Sleep -Milliseconds 700 }
}
if (-not $healthy) {
  Write-Host "Backend did not come up on :8000 - check the uvicorn output above." -ForegroundColor Red
  exit 1
}

# --- optional: inject a fake test profile (opt-in via -SeedProfile) ----------
# By default profiles are blank and fill from a scanned ID; only seed on explicit request.
if ($SeedProfile) {
  try {
    $maria = @{
      name = 'Maria Popescu'; first_name = 'Maria'; last_name = 'Popescu'
      cnp = '6060514400011'; sex = 'F'; birthdate = '2006-05-14'
      place_of_birth = 'Mun. Bucuresti'; nationality = 'Romanian'; country = 'Romania'
      address = 'Mun. Bucuresti, Sector 3, Str. Exemplu nr. 12'
      series = 'RX'; doc_number = '123456'; issued_by = 'SPCLEP Sector 3'
      issue_date = '2018-06-01'; expiry_date = '2028-05-14'
    } | ConvertTo-Json
    $p = Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/docs/profile' -Body $maria -ContentType 'application/json'
    Write-Host ("Demo profile locked: {0} / {1} / {2}" -f $p.profile.name, $p.profile.country, $p.profile.birthdate) -ForegroundColor Green
  } catch {
    Write-Host "Could not lock demo profile (continuing): $_" -ForegroundColor Yellow
  }
}

# --- pre-warm RAG with the rehearsed questions -------------------------------
$questions = @(
  'How do I apply for Erasmus+ as a student?',
  'Am I eligible for the European Solidarity Corps?',
  'What is DiscoverEU and how do I get a travel pass?',
  'Do I need a visa to work in another EU country?',
  'What is the EHIC and what does it cover?',
  'How do I get my diploma recognised in another EU country?'
)
Write-Host "Pre-warming RAG (embeddings + Chroma) with the demo questions ..." -ForegroundColor Cyan
$warm = 0
foreach ($q in $questions) {
  try {
    $body = @{ query = $q } | ConvertTo-Json
    $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/tools/search_eu_info' -Body $body -ContentType 'application/json' -TimeoutSec 30
    $n = 0; try { $n = $r.results.Count } catch {}
    Write-Host ("  [{0} hits] {1}" -f $n, $q)
    if ($n -gt 0) { $warm++ }
  } catch {
    Write-Host ("  [FAILED] {0} :: {1}" -f $q, $_) -ForegroundColor Yellow
  }
}
Write-Host ("RAG pre-warm done: {0}/{1} questions returned sourced chunks." -f $warm, $questions.Count) -ForegroundColor Green

Write-Host ""
Write-Host "READY. Keep this window open. Server pid $($server.Id) on :8000." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop (or: Stop-Process -Id $($server.Id))."

# Block so the server keeps running and Ctrl+C tears it down with the script.
try { Wait-Process -Id $server.Id } finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
