@echo off
REM Atlased Backend Dev Startup Script (Windows)
REM Sets environment variables and starts the backend

setlocal enabledelayedexpansion

echo Setting environment variables...
set DATABASE_PROVIDER=sqlite
set DATABASE_URL=file:./atlased-dev.db
set JWT_SECRET=+iqzhgengiac3yPQotwJPEbovE6B2nC1iUqs90QZYG2PcN6AxX4XMTfUhfVqhR9B
set CORS_ORIGIN=http://localhost:5173
set NODE_ENV=development
set PORT=4000

echo.
echo ✅ Environment variables set
echo DATABASE_URL: !DATABASE_URL!
echo JWT_SECRET: (set)
echo CORS_ORIGIN: !CORS_ORIGIN!
echo.
echo Starting backend...
npm run dev
