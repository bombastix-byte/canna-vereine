#!/usr/bin/env bash
# Offsite-taugliche Sicherung der PocketBase-Daten aller Vereine.
# Empfehlung zusaetzlich: in jeder PocketBase unter Einstellungen die
# eingebauten geplanten Backups aktivieren. Dieses Skript sichert die
# kompletten Datenvolumes und haelt 14 Tage vor.
#
# Per Cron, z. B. taeglich 3 Uhr:
#   0 3 * * * /pfad/zu/deploy/backup.sh >> /var/log/canna-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$(pwd)/backups"
mkdir -p "$OUT"

for vol in canna_pb_goerlitz canna_pb_goerlitz2 canna_pb_leipzig; do
	if docker volume inspect "$vol" >/dev/null 2>&1; then
		docker run --rm \
			-v "$vol":/data:ro \
			-v "$OUT":/backup \
			alpine tar czf "/backup/${vol}-${STAMP}.tgz" -C /data .
		echo "gesichert: ${vol}-${STAMP}.tgz"
	else
		echo "uebersprungen (kein Volume): $vol"
	fi
done

# Rotation: aelter als 14 Tage entfernen
find "$OUT" -name '*.tgz' -mtime +14 -delete
echo "Backup fertig: $STAMP"
