// Mitglieds-Selbstverwaltung: Feld telefon + updateRule, die Mitgliedern erlaubt,
// AUSSCHLIESSLICH ihre eigenen Kontakt-/SEPA-Daten zu ändern. Rollen, Beiträge,
// Identität und Mahnfelder bleiben dem Vorstand vorbehalten (per :isset-Guards
// gegen Rechte-Eskalation). Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const col = await pb.collections.getOne('users');

// 1) Feld telefon.
if (!(col.fields ?? []).some((f) => f.name === 'telefon')) {
  await pb.collections.update('users', { fields: [...col.fields, { name: 'telefon', type: 'text' }] });
  console.log('users: Feld telefon ergaenzt.');
} else {
  console.log('users: telefon bereits vorhanden.');
}

// 2) updateRule: Vorstand darf alles; Mitglied darf sich selbst nur ändern,
//    wenn KEINES der geschützten Felder mitgeschickt wird.
const geschuetzt = [
  'rollen', 'rolle', 'mitgliedsnummer', 'beitrag_bis', 'beitrag_monatlich',
  'geburtsdatum', 'vorname', 'nachname', 'mahnstufe', 'gemahnt_am',
];
const guards = geschuetzt.map((f) => `@request.body.${f}:isset = false`).join(' && ');
const regel = `@request.auth.rollen ~ "vorstand" || (id = @request.auth.id && ${guards})`;

if (col.updateRule !== regel) {
  await pb.collections.update('users', { updateRule: regel });
  console.log('users: updateRule für Selbstverwaltung gesetzt.');
} else {
  console.log('users: updateRule bereits gesetzt.');
}

console.log('Fertig.');
