# Atlased Backend Dev Startup Script (PowerShell)
# Sets environment variables and starts the backend

Write-Host "Setting environment variables..." -ForegroundColor Cyan

$env:DATABASE_PROVIDER="sqlite"
$env:DATABASE_URL="file:./atlased-dev.db"
$env:JWT_SECRET="+iqzhgengiac3yPQotwJPEbovE6B2nC1iUqs90QZYG2PcN6AxX4XMTfUhfVqhR9B"
$env:CORS_ORIGIN="http://localhost:5173"
$env:NODE_ENV="development"
$env:PORT="4000"

Write-Host ""
Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Gray
Write-Host "JWT_SECRET: (set)" -ForegroundColor Gray
Write-Host "CORS_ORIGIN: $env:CORS_ORIGIN" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting backend..." -ForegroundColor Cyan
npm run dev
