@echo off
cd /d "%~dp0backend"

if not exist "..\\.env" (
  echo [ERROR] .env file not found.
  echo        Copy .env.example to .env and fill in your API_KEY.
  pause
  exit /b 1
)

set PYTHON=D:\Python-stuwlf\Python\python.exe
if not exist "%PYTHON%" set PYTHON=python

echo [INFO] Installing / verifying dependencies...
"%PYTHON%" -m pip install -q -r requirements.txt

echo.
echo ================================================
echo  WanderMind ^| open: http://localhost:8000
echo ================================================
echo.

"%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
