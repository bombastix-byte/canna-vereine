// System-Konto für die Erinnerungs-Automatik: ein dediziertes Vorstand-Konto,
// mit dem der /api/erinnerungen-Endpoint PocketBase liest/schreibt. E-Mail und
// Passwort kommen aus SYSTEM_EMAIL / SYSTEM_PW (müssen mit der Server-.env
// übereinstimmen). Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const SYS_EMAIL = process.env.SYSTEM_EMAIL;
const SYS_PW = process.env.SYSTEM_PW;

if (!SYS_EMAIL || !SYS_PW) {
  console.error('SYSTEM_EMAIL und SYSTEM_PW müssen gesetzt sein.');
  process.exit(1);
}

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

let vorhanden = null;
try {
  vorhanden = await pb.collection('users').getFirstListItem(`email="${SYS_EMAIL}"`);
} catch {
  vorhanden = null;
}

if (vorhanden) {
  // Passwort/Rolle auf den gewünschten Stand bringen.
  await pb.collection('users').update(vorhanden.id, {
    password: SYS_PW,
    passwordConfirm: SYS_PW,
    rollen: ['vorstand'],
    mitglied_status: 'aktiv',
  });
  console.log('System-Konto aktualisiert:', SYS_EMAIL);
} else {
  await pb.collection('users').create({
    email: SYS_EMAIL,
    password: SYS_PW,
    passwordConfirm: SYS_PW,
    name: 'System (Automatik)',
    mitgliedsnummer: 'SYS',
    rollen: ['vorstand'],
    mitglied_status: 'aktiv',
    hinweise_version: '2026-07',
  });
  console.log('System-Konto angelegt:', SYS_EMAIL);
}
console.log('Fertig.');
