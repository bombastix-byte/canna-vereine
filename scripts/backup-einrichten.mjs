// Aktiviert PocketBases eingebaute automatische Backups (konsistente
// SQLite-Sicherungen) mit Zeitplan und Aufbewahrung. Optional gleich ein
// Test-Backup auslösen (--jetzt). Pro Verein einmal ausführen.
//
//   PB_URL=… PB_ADMIN_EMAIL=… PB_ADMIN_PW=… node scripts/backup-einrichten.mjs [--jetzt]
//
// Zeitplan/Aufbewahrung über Env übersteuerbar: BACKUP_CRON, BACKUP_KEEP.
// Die Backups liegen im Container unter /pb/pb_data/backups — per Bind-Mount
// (siehe docker-compose.yml) auf dem Host, damit sie einen Volume-Verlust
// überleben. Für echte Katastrophensicherheit dieses Host-Verzeichnis
// zusätzlich off-site sichern (rsync/S3 — siehe deploy/ONBOARDING.md).
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const CRON = process.env.BACKUP_CRON ?? '0 3 * * *'; // täglich 03:00 (Container-Zeit)
const KEEP = Number(process.env.BACKUP_KEEP ?? 7);

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

await pb.settings.update({ backups: { cron: CRON, cronMaxKeep: KEEP } });
console.log(`Automatische Backups aktiv: "${CRON}", Aufbewahrung ${KEEP} Stände.`);

if (process.argv.includes('--jetzt')) {
  await pb.backups.create('');
  console.log('Test-Backup ausgelöst.');
  const liste = await pb.backups.getFullList();
  console.log('Vorhandene Backups:', liste.map((b) => `${b.key} (${Math.round((b.size || 0) / 1024)} KB)`).join(', ') || '—');
}
console.log('Fertig.');
