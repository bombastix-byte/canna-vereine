@echo off
REM canna PocketBase (CMS) auf Port 8090. Wird vom Cockpit detached gestartet.
cd /d D:\Claude\Projects\canna-vereine
pb\pocketbase.exe serve --http=127.0.0.1:8090
