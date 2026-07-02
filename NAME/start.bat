@echo off
<<<<<<< Updated upstream
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
=======
setlocal enabledelayedexpansion

:: ============================================================
::  If called with a service argument, run that service only
:: ============================================================
if "%1"=="api" goto :run_api
if "%1"=="ai"  goto :run_ai
if "%1"=="web" goto :run_web

:: ============================================================
::   PHC Exchange — One-Click Startup Script (Main Entry)
::   Starts: API Backend (8000) + AI Service (8001) + Frontend (3000)
:: ============================================================
title PHC Exchange — Starting Up...
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "VENV=%ROOT%\.venv\Scripts"

echo.
echo  ==========================================
echo   PHC Exchange - AI-Powered Network
echo   Starting all services...
echo  ==========================================
echo.

:: ── 1. Check Python venv ─────────────────────────────────
echo [1/4] Checking Python virtual environment...
if not exist "%VENV%\python.exe" (
    echo.
    echo  ERROR: Python venv not found at .venv\Scripts\python.exe
    echo  Please run: python -m venv .venv ^& .venv\Scripts\pip install -e .
    echo.
    pause
    exit /b 1
)
echo       OK - Found .venv\Scripts\python.exe
echo.

:: ── 2. Check Node / npm ──────────────────────────────────
echo [2/4] Checking Node.js...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: npm not found. Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo       OK - npm found
echo.

:: ── 3. Check PostgreSQL port 5432 ────────────────────────
echo [3/4] Checking PostgreSQL (port 5432)...
netstat -an | find "5432" | find "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  WARNING: PostgreSQL does not appear to be running on port 5432.
    echo  Attempting to start via Windows service...
    net start postgresql >nul 2>&1
    if errorlevel 1 (
        net start "postgresql-x64-15" >nul 2>&1
        if errorlevel 1 (
            net start "postgresql-x64-16" >nul 2>&1
        )
    )
    timeout /t 3 /nobreak >nul
    netstat -an | find "5432" | find "LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo  WARNING: Could not confirm PostgreSQL is running.
        echo  The app may fail to connect to the database.
        echo  Please start PostgreSQL manually, then press any key to continue.
        pause >nul
    ) else (
        echo       OK - PostgreSQL started
    )
) else (
    echo       OK - PostgreSQL is running
)
echo.

:: ── 4. Start all services (each calls this same bat with an argument) ──
echo [5/5] Starting services...
echo.

:: Check Redis before bringing up the app services
echo [4/5] Checking Redis (port 6379)...
netstat -an | find "6379" | find "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  WARNING: Redis does not appear to be running on port 6379.
    where docker >nul 2>&1
    if errorlevel 1 (
        echo  Docker was not found, so Redis will stay unavailable.
        echo  The app can still run, but Redis-backed eventing and rate limiting will be disabled.
    ) else (
        echo  Attempting to start Redis via Docker...
        docker compose -f "%ROOT%\infrastructure\docker\docker-compose.yml" up -d redis
        timeout /t 3 /nobreak >nul
        netstat -an | find "6379" | find "LISTENING" >nul 2>&1
        if errorlevel 1 (
            echo  WARNING: Redis still is not listening on port 6379.
            echo  The app can continue without Redis, but features depending on it will be degraded.
        ) else (
            echo       OK - Redis started
        )
    )
) else (
    echo       OK - Redis is running
)
echo.

set "API_PORT="
for %%P in (8000 8002 8010 8080) do (
    netstat -an | findstr /R /C:":%%P .*LISTENING" >nul 2>&1
    if errorlevel 1 if not defined API_PORT set "API_PORT=%%P"
)
if not defined API_PORT set "API_PORT=8000"
set "NEXT_PUBLIC_API_URL=http://localhost:%API_PORT%"

echo  [API Backend]  Starting on http://localhost:%API_PORT%
start "PHC Exchange - API (port %API_PORT%)" cmd /k ""%~f0" api"

timeout /t 2 /nobreak >nul

echo  [AI Service]   Starting on http://localhost:8001
start "PHC Exchange - AI Service (port 8001)" cmd /k ""%~f0" ai"

timeout /t 3 /nobreak >nul

echo  [Frontend]     Starting on http://localhost:3000
start "PHC Exchange - Frontend (port 3000)" cmd /k ""%~f0" web"

echo.
echo  ==========================================
echo   All 3 services are starting up!
echo  ==========================================
echo.
echo   API Backend :  http://localhost:%API_PORT%
echo   AI Service  :  http://localhost:8001
echo   Frontend    :  http://localhost:3000
echo.
echo   Opening browser in 10 seconds...
echo   (The frontend takes ~30s to compile on first run)
echo.

timeout /t 10 /nobreak >nul

echo  Opening http://localhost:3000/login in your browser...
start "" "http://localhost:3000/login"

echo.
echo  ==========================================
echo   PHC Exchange is running!
echo   Close the individual terminal windows
echo   to stop each service.
echo  ==========================================
echo.
pause
goto :eof

:: ============================================================
::  SERVICE RUNNERS (called by child windows)
:: ============================================================

:run_api
title PHC Exchange - API Backend
color 0B
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
echo.
if not defined API_PORT set "API_PORT=8000"
echo  PHC Exchange - API Backend - http://localhost:%API_PORT%
echo  Press Ctrl+C to stop
echo.
"%ROOT%\.venv\Scripts\python.exe" -m uvicorn apps.api.app.main:app --port %API_PORT% --host 127.0.0.1
pause
goto :eof

:run_ai
title PHC Exchange - AI Service
color 0D
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
echo.
echo  PHC Exchange - AI Service - http://localhost:8001
echo  Press Ctrl+C to stop
echo.
cd /d "%ROOT%\apps\ai-service"
"%ROOT%\.venv\Scripts\python.exe" -m uvicorn app.main:app --port 8001 --host 127.0.0.1
pause
goto :eof

:run_web
title PHC Exchange - Frontend
color 0E
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
echo.
echo  PHC Exchange - Frontend - http://localhost:3000
echo  Press Ctrl+C to stop
echo.
cd /d "%ROOT%\apps\web"
npm run dev
pause
goto :eof
>>>>>>> Stashed changes
