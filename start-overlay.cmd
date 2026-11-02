@echo off
cd /d "%~dp0"
call npm.cmd run overlay
if errorlevel 1 pause
