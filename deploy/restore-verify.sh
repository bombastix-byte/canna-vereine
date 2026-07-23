#!/usr/bin/env bash
# Stellt die jeweils neueste Sicherung jedes vorhandenen Vereins testweise in
# ein temporaeres Docker-Volume wieder her und prueft die PocketBase-Datenbank.
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="$(pwd)/backups"
VOLUMES=(canna_pb_goerlitz canna_pb_cvg canna_pb_goerlitz2 canna_pb_leipzig)
geprueft=0

for quelle in "${VOLUMES[@]}"; do
	archiv="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${quelle}-*.tgz" -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
	if [ -z "$archiv" ]; then
		echo "uebersprungen (kein Archiv): $quelle"
		continue
	fi

	testvol="cvms_restore_test_${quelle}_$$"
	docker volume create "$testvol" >/dev/null
	cleanup() { docker volume rm -f "$testvol" >/dev/null 2>&1 || true; }
	trap cleanup EXIT

	docker run --rm \
		-v "$testvol":/restore \
		-v "$archiv":/backup.tgz:ro \
		alpine sh -ec 'tar xzf /backup.tgz -C /restore; test -s /restore/data.db'

	cleanup
	trap - EXIT
	echo "Restore verifiziert: $(basename "$archiv")"
	geprueft=$((geprueft + 1))
done

if [ "$geprueft" -eq 0 ]; then
	echo "FEHLER: Kein Backup zum Verifizieren gefunden." >&2
	exit 1
fi
echo "Restore-Test bestanden: $geprueft Archiv(e)."
