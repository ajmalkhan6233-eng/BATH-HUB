@echo off
title Stop AI Empire
color 0C
echo Stopping AI Empire Stack...
cd /d "C:\Users\1st Choice\AI-EMPIRE"
docker compose down
taskkill /F /IM "ollama.exe" /T >nul 2>&1
echo.
echo All services stopped.
pause
