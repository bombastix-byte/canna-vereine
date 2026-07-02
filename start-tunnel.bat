@echo off
REM Cloudflare Quick-Tunnel auf die lokale canna-Demo (Port 4321).
REM cloudflared schreibt seine Logs (inkl. der oeffentlichen trycloudflare-URL)
REM ueber den eigenen --logfile-Schalter; das Cockpit liest die URL dort aus.
cd /d D:\Claude\Projects\canna-vereine
if exist tunnel.log del /f /q tunnel.log
"C:\Users\sebas\AppData\Local\Microsoft\WinGet\Links\cloudflared.exe" tunnel --url http://127.0.0.1:4321 --http-host-header 127.0.0.1:4321 --logfile D:\Claude\Projects\canna-vereine\tunnel.log --loglevel info
