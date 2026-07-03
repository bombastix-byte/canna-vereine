#!/usr/bin/env bash
# Taegliche Sicherung der PocketBase-Daten aller Vereine.
# Sichert die kompletten Datenvolumes (DB + hochgeladene Dateien) und haelt
# 14 Tage lokal vor. Optional Offsite: setze BACKUP_REMOTE (rsync-Ziel), dann
# wird der Ordner zusaetzlich dorthin gespiegelt.
#
# Einrichtung per Cron (taeglich 3:15 Uhr) - macht das Setup-Skript automatisch:
#   15 3 * * * /opt/canna-vereine/deploy/backup.sh >> /var/log/canna-backup.log 2>&1
#
# Offsite-Beispiel (in die Cron-Zeile oder /etc/environment):
#   BACKUP_REMOTE="user@backup-host:/pfad/canna-backups/"   (braucht SSH-Key)
set -euo pipefail
cd "$(dirname "$0")"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$(pwd)/backups"
mkdir -p "$OUT"

erfolg=0
for vol in canna_pb_goerlitz canna_pb_goerlitz2 canna_pb_leipzig; do
	if docker volume inspect "$vol" >/dev/null 2>&1; then
		docker run --rm \
			-v "$vol":/data:ro \
			-v "$OUT":/backup \
			alpine tar czf "/backup/${vol}-${STAMP}.tgz" -C /data .
		echo "gesichert: ${vol}-${STAMP}.tgz ($(du -h "$OUT/${vol}-${STAMP}.tgz" | cut -f1))"
		erfolg=$((erfolg + 1))
	else
		echo "uebersprungen (kein Volume): $vol"
	fi
done

# Rotation: aelter als 14 Tage entfernen
find "$OUT" -name '*.tgz' -mtime +14 -delete

# Optional: Offsite-Spiegel per rsync (nur wenn BACKUP_REMOTE gesetzt ist)
if [ -n "${BACKUP_REMOTE:-}" ]; then
	if command -v rsync >/dev/null 2>&1; then
		rsync -az --delete "$OUT/" "$BACKUP_REMOTE" && echo "offsite gespiegelt -> $BACKUP_REMOTE"
	else
		echo "WARN: rsync fehlt, Offsite-Spiegel uebersprungen."
	fi
fi

echo "Backup fertig: $STAMP ($erfolg Volume(s))"
