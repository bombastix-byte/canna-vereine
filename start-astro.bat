@echo off
REM canna Astro Dev-Server (Goerlitz) auf Port 4321. Vom Cockpit detached gestartet.
cd /d D:\Claude\Projects\canna-vereine
set SITE_ID=goerlitz
set PB_URL=http://127.0.0.1:8090
call npm run dev -- --host 127.0.0.1 --port 4321
