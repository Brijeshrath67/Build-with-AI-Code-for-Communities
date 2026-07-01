@echo off
title PHC Exchange - Development Startup

echo.
echo ==========================================
echo  PHC Exchange - Starting All Services
echo ==========================================
echo.

:: Set PGPASSWORD for psql seed operation
set PGPASSWORD=phc_password

:: Apply database schema and seed (idempotent)
echo [1/4] Applying database schema and seed...
psql -U phc_user -d phc_exchange -f database\schema.sql >NUL 2>&1
psql -U phc_user -d phc_exchange -f database\seed\seed.sql >NUL 2>&1
echo      Done.

:: Start Backend API (port 8000)
echo [2/4] Starting Backend API on port 8000...
start "PHC-API" cmd /k "cd /d %~dp0 && set PGPASSWORD=phc_password && python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait 2 seconds before starting AI service
timeout /t 2 /nobreak >NUL

:: Start AI Service (port 8001)
echo [3/4] Starting AI Microservice on port 8001...
start "PHC-AI" cmd /k "cd /d %~dp0\apps\ai-service && set PGPASSWORD=phc_password && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

:: Wait 2 seconds before starting frontend
timeout /t 2 /nobreak >NUL

:: Start Next.js Frontend (port 3000)
echo [4/4] Starting Frontend on port 3000...
start "PHC-WEB" cmd /k "cd /d %~dp0 && npm run dev:web"

echo.
echo ==========================================
echo  Services starting in background windows!
echo.
echo  Frontend:   http://localhost:3000
echo  Backend API: http://localhost:8000/docs
echo  AI Service: http://localhost:8001/docs
echo ==========================================
echo.
echo  Demo Login: Phone 7777777777 / Password: password123
echo.
pause
