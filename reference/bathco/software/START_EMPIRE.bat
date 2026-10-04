@echo off
title AJMAL KHAN — AI EMPIRE LAUNCHER
color 0A
echo.
echo  ######################################################
echo  #       AJMAL KHAN AI EMPIRE STACK                  #
echo  #       1st Choice Bathco - Local AI System         #
echo  ######################################################
echo.

REM ── Check Docker is running ──────────────────────────────────────
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running.
    echo Please start Docker Desktop from the taskbar first.
    echo Then run this file again.
    pause
    exit /b 1
)

echo [OK] Docker is running.
echo.

REM ── Start Ollama (local AI) ──────────────────────────────────────
echo [1/2] Starting Ollama (local AI models)...
start "Ollama" /min ollama serve
timeout /t 3 /nobreak >nul

REM ── Start all Docker services ────────────────────────────────────
echo [2/2] Starting all Docker services...
cd /d "C:\Users\1st Choice\AI-EMPIRE"
docker compose up -d

echo.
echo  ######################################################
echo   WAITING 30 SECONDS FOR SERVICES TO INITIALIZE...
echo  ######################################################
timeout /t 30 /nobreak

echo.
echo  ######################################################
echo   AJMAL KHAN AI EMPIRE STACK — ALL SYSTEMS UP
echo  ######################################################
echo.
echo   Open WebUI  (AI Chat)       →  http://localhost:3000
echo   n8n         (Automation)    →  http://localhost:5678
echo   Portainer   (Docker Mgmt)   →  http://localhost:9000
echo   Metabase    (Analytics)     →  http://localhost:3001
echo   Uptime Kuma (Monitoring)    →  http://localhost:3002
echo.
echo   n8n Login: ajmal / bathco2026
echo.
echo  ######################################################
echo.
echo Press any key to open all dashboards in browser...
pause >nul

start http://localhost:3000
timeout /t 1 /nobreak >nul
start http://localhost:5678
timeout /t 1 /nobreak >nul
start http://localhost:9000
timeout /t 1 /nobreak >nul
start http://localhost:3001
timeout /t 1 /nobreak >nul
start http://localhost:3002
