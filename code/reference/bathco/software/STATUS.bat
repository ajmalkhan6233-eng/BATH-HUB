@echo off
title AI Empire Status
echo.
echo  ====== AJMAL KHAN AI EMPIRE — STATUS ======
echo.
echo [Ollama]
ollama --version 2>nul || echo  NOT running
echo.
echo [Docker Services]
docker compose -f "C:\Users\1st Choice\AI-EMPIRE\docker-compose.yml" ps
echo.
echo  ==========================================
echo   Open WebUI  →  http://localhost:3000
echo   n8n         →  http://localhost:5678
echo   Portainer   →  http://localhost:9000
echo   Metabase    →  http://localhost:3001
echo   Uptime Kuma →  http://localhost:3002
echo  ==========================================
pause
