@echo off
setlocal enabledelayedexpansion

if /I "%~1"=="api" goto :run_api
if /I "%~1"=="ai" goto :run_ai
if /I "%~1"=="web" goto :run_web

title PHC Exchange - Starting Up
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "VENV=%ROOT%\.venv\Scripts"
set "PGPASSWORD=phc_password"
set "DATABASE_URL=postgresql+pg8000://phc_user:phc_password@localhost:5432/phc_exchange"
set "AI_SERVICE_URL=http://localhost:8001"
set "REDIS_URL=redis://localhost:6379/0"

echo.
echo  ==========================================
echo   PHC Exchange - AI-Powered Network
echo   Starting all services...
echo  ==========================================
echo.

echo [1/5] Checking Python virtual environment...
if not exist "%VENV%\python.exe" (
    echo.
    echo  ERROR: Python venv not found at:
    echo  %VENV%\python.exe
    echo.
    echo  Run these from the NAME folder:
    echo  python -m venv .venv
    echo  .venv\Scripts\python.exe -m pip install -r apps\api\requirements.txt
    echo  .venv\Scripts\python.exe -m pip install -r apps\ai-service\requirements.txt
    echo.
    pause
    exit /b 1
)
echo       OK
echo.

echo [2/5] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: npm was not found. Install Node.js, then run npm install from the NAME folder.
    echo.
    pause
    exit /b 1
)
echo       OK
echo.

echo [3/5] Checking PostgreSQL on port 5432...
netstat -an | findstr /R /C:":5432 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo       WARNING: PostgreSQL does not appear to be listening on 5432.
    echo       Start PostgreSQL before logging in, or the API will fail database requests.
) else (
    echo       OK
)
echo.

echo [4/5] Applying database schema and seed if psql is available...
where psql >nul 2>&1
if errorlevel 1 (
    echo       SKIPPED: psql was not found in PATH.
) else (
    psql -U phc_user -d phc_exchange -f "%ROOT%\database\schema.sql" >nul 2>&1
    if errorlevel 1 (
        echo       WARNING: schema.sql could not be applied. Check PostgreSQL user/database.
    ) else (
        psql -U phc_user -d phc_exchange -f "%ROOT%\database\seed\seed.sql" >nul 2>&1
        if errorlevel 1 (
            echo       WARNING: seed.sql could not be applied. Existing database data may be used.
        ) else (
            echo       OK
        )
    )
)
echo.

echo [5/5] Checking Redis on port 6379...
netstat -an | findstr /R /C:":6379 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo       WARNING: Redis is not listening on 6379.
    echo       The app can still start, but event/rate-limit features may be degraded.
) else (
    echo       OK
)
echo.

set "API_PORT="
for %%P in (8000 8002 8010 8080) do (
    netstat -an | findstr /R /C:":%%P .*LISTENING" >nul 2>&1
    if errorlevel 1 if not defined API_PORT set "API_PORT=%%P"
)
if not defined API_PORT set "API_PORT=8000"
set "NEXT_PUBLIC_API_URL=http://localhost:%API_PORT%"

echo Starting services in separate windows...
echo.
echo  API Backend : http://localhost:%API_PORT%
start "PHC Exchange - API" cmd /k ""%~f0" api"

timeout /t 2 /nobreak >nul

echo  AI Service  : http://localhost:8001
start "PHC Exchange - AI Service" cmd /k ""%~f0" ai"

timeout /t 3 /nobreak >nul

echo  Frontend    : http://localhost:3000
start "PHC Exchange - Frontend" cmd /k ""%~f0" web"

echo.
echo  ==========================================
echo   PHC Exchange is starting.
echo   Frontend: http://localhost:3000/login
echo   API docs: http://localhost:%API_PORT%/docs
echo   AI docs : http://localhost:8001/docs
echo  ==========================================
echo.

timeout /t 8 /nobreak >nul
start "" "http://localhost:3000/login"
pause
goto :eof

:run_api
title PHC Exchange - API Backend
color 0B
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
if not defined API_PORT set "API_PORT=8000"
set "DATABASE_URL=postgresql+pg8000://phc_user:phc_password@localhost:5432/phc_exchange"
set "AI_SERVICE_URL=http://localhost:8001"
set "REDIS_URL=redis://localhost:6379/0"
cd /d "%ROOT%"
echo.
echo  API Backend running on http://localhost:%API_PORT%
echo  Press Ctrl+C to stop.
echo.
"%ROOT%\.venv\Scripts\python.exe" -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port %API_PORT% --reload
pause
goto :eof

:run_ai
title PHC Exchange - AI Service
color 0D
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "DATABASE_URL=postgresql+pg8000://phc_user:phc_password@localhost:5432/phc_exchange"
set "REDIS_URL=redis://localhost:6379/0"
cd /d "%ROOT%\apps\ai-service"
echo.
echo  AI Service running on http://localhost:8001
echo  Press Ctrl+C to stop.
echo.
"%ROOT%\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
pause
goto :eof

:run_web
title PHC Exchange - Frontend
color 0E
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
if not defined NEXT_PUBLIC_API_URL set "NEXT_PUBLIC_API_URL=http://localhost:8000"
cd /d "%ROOT%\apps\web"
echo.
echo  Frontend running on http://localhost:3000
echo  Press Ctrl+C to stop.
echo.
npm run dev
pause
goto :eof
