@echo off

:: Launch Python script in a new cmd window
start "Backend" cmd /k D:\Conda_envs\LLM\python.exe .\python-backend\server.py

:: Launch npm dev server in a new cmd window
start "Web App" cmd /k "npm run dev"