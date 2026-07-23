# PocketBase-Schema

Die kanonische Schemaquelle sind die idempotenten `scripts/seed-*.mjs`-Dateien.
Neue Instanzen werden mit `scripts/seed-struktur.mjs` aufgebaut. PocketBase
laeuft in Produktion und CI deshalb mit `--automigrate=false`.

`pb_migrations/` enthaelt historische, von der PocketBase-Adminoberflaeche
erzeugte Entwicklungsartefakte. Sie bilden keine von null lauffaehige lineare
Migrationskette und duerfen nicht fuer ein neues Produktiv-Volume verwendet
werden. Zwei widerspruechliche Vorbestellungs-Artefakte wurden entfernt; der
Rest bleibt nur zur Historie und zum Nachvollziehen alter Collection-Staende.

Verifikation einer neuen Instanz:

1. PocketBase mit leerem Datenverzeichnis und `--automigrate=false` starten.
2. `node scripts/seed-struktur.mjs` ausfuehren.
3. `node scripts/check-schema.mjs` ausfuehren.
4. Kritische HTTP-/Race-Tests laufen lassen.

Die Server-CI fuehrt genau diesen Ablauf automatisch aus.
