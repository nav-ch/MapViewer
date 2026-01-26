Write-Host "Building and Starting MapViewer Production Environment..." -ForegroundColor Cyan

$root = Get-Location

# Build Admin
Write-Host "Building Admin Panel..." -ForegroundColor Yellow
Set-Location "$root\admin"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Admin build failed"; exit 1 }

# Build Plugin
Write-Host "Building Plugin..." -ForegroundColor Yellow
Set-Location "$root\plugin"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Plugin build failed"; exit 1 }

# Prepare Plugin Dist
Write-Host "Configuring Plugin Entry Point..." -ForegroundColor Yellow
Copy-Item "$root\plugin\prod_index.html" -Destination "$root\plugin\dist\index.html" -Force

# Start Server
Write-Host "Starting Backend Server (Serving All Apps)..." -ForegroundColor Green
Set-Location "$root\server"
node index.js
