# Initialize Rankforge for manual requirement testing (FR-05 and related).
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/init-requirement-testing.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiPython = Join-Path $RepoRoot "apps\api\venv\Scripts\python.exe"
$WebDir = Join-Path $RepoRoot "apps\web"
$ApiDir = Join-Path $RepoRoot "apps\api"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-EnvConfigured {
    $webEnv = Join-Path $WebDir ".env.local"
    $apiEnv = Join-Path $ApiDir ".env"
    if (-not (Test-Path $webEnv)) {
        throw "Missing apps/web/.env.local — copy from apps/web/.env.example"
    }
    if (-not (Test-Path $apiEnv)) {
        throw "Missing apps/api/.env — copy from apps/api/.env.example"
    }
}

function Test-DevAuthConfigured {
    $webEnv = Get-Content (Join-Path $WebDir ".env.local")
    return ($webEnv | Where-Object { $_ -match '^DEV_AUTH_BYPASS=true' }).Count -gt 0
}

Write-Step "Checking environment files"
Test-EnvConfigured

Write-Step "Installing dependencies"
if (-not (Test-Path $ApiPython)) {
    Push-Location $ApiDir
    python -m venv venv
    & ".\venv\Scripts\pip.exe" install -r requirements.txt
    Pop-Location
} else {
    & $ApiPython -m pip install -r (Join-Path $ApiDir "requirements.txt") | Out-Null
}

Push-Location $WebDir
npm install
Pop-Location

Write-Step "Running automated requirement tests"
Push-Location $WebDir
npm test
if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed" }
Pop-Location

Push-Location $RepoRoot
$env:PYTHONPATH = $RepoRoot
& $ApiPython -m pytest apps/api/tests/test_drafts.py -q
if ($LASTEXITCODE -ne 0) { throw "Draft API tests failed" }
Pop-Location

if (-not (Test-DevAuthConfigured)) {
    Write-Step "Configuring dev auth bypass"
    Push-Location $RepoRoot
    & $ApiPython apps/api/scripts/seed_dev_user.py
    if ($LASTEXITCODE -ne 0) {
        throw "seed_dev_user.py failed — add SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    }
    Pop-Location
} else {
    Write-Host "Dev auth bypass already configured"
}

Write-Step "Seeding FR-05 requirement test fixtures"
Push-Location $RepoRoot
$env:PYTHONPATH = $RepoRoot
& $ApiPython apps/api/scripts/seed_requirement_test_data.py
if ($LASTEXITCODE -ne 0) { throw "Requirement test seed failed" }
Pop-Location

Write-Step "Starting dev servers"
$apiJob = Start-Job -ScriptBlock {
    param($Root, $Python)
    Set-Location $Root
    $env:PYTHONPATH = $Root
    & $Python -m uvicorn apps.api.main:app --reload --port 8000
} -ArgumentList $RepoRoot, $ApiPython

Start-Sleep -Seconds 2

$webJob = Start-Job -ScriptBlock {
    param($Dir)
    Set-Location $Dir
    npm.cmd run dev
} -ArgumentList $WebDir

Write-Host ""
Write-Host "Requirement testing environment initialized." -ForegroundColor Green
Write-Host "  Web:  http://localhost:3000"
Write-Host "  API:  http://localhost:8000/health"
Write-Host ""
Write-Host "Background jobs:"
Write-Host "  API job id: $($apiJob.Id)"
Write-Host "  Web job id: $($webJob.Id)"
Write-Host ""
Write-Host "To view server output:"
Write-Host "  Receive-Job -Id $($apiJob.Id) -Keep"
Write-Host "  Receive-Job -Id $($webJob.Id) -Keep"
Write-Host ""
Write-Host "To stop servers:"
Write-Host "  Stop-Job -Id $($apiJob.Id),$($webJob.Id); Remove-Job -Id $($apiJob.Id),$($webJob.Id)"
