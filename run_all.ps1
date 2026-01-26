Write-Host "Starting MapViewer Environment..." -ForegroundColor Cyan

$root = Get-Location

# Start Backend
Write-Host "Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; node index.js"

# Start Admin Frontend
Write-Host "Starting Admin Panel..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; npm run dev"

# Start Plugin Frontend
Write-Host "Starting Plugin..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\plugin'; npm run dev"

Write-Host "All services started." -ForegroundColor Cyan
