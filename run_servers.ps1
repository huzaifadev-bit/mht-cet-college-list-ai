# MHT CET AI College Predictor Platform Launcher

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Starting MHT CET AI College Predictor Platform" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start PostgreSQL Docker container
Write-Host "[1/3] Verifying PostgreSQL container status..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error starting PostgreSQL container. Ensure Docker is running." -ForegroundColor Red
    exit 1
}
Write-Host "PostgreSQL Database container is active." -ForegroundColor Green

# 2. Launch FastAPI Backend
Write-Host "[2/3] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\uvicorn backend.main:app --reload --port 8000"
Write-Host "Backend server launch command executed in a separate window." -ForegroundColor Green

# 3. Launch Next.js Frontend
Write-Host "[3/3] Launching Next.js Frontend on http://localhost:3000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
Write-Host "Frontend server launch command executed in a separate window." -ForegroundColor Green

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   System Initialized Successfully!" -ForegroundColor Green
Write-Host "   - Backend API: http://localhost:8000" -ForegroundColor Gray
Write-Host "   - Frontend App: http://localhost:3000" -ForegroundColor Gray
Write-Host "   (Separate PowerShell windows have been opened for logs)" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
