Write-Host "Stopping all MapViewer services..." -ForegroundColor Yellow

# Kill all Node.js processes
# This stops both the Backend API and the Vite Dev Servers
Write-Host "Terminating Node.js processes..." -ForegroundColor Cyan
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "All services stopped." -ForegroundColor Green
