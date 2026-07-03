// Ergaenzt die Mitglieder um SEPA-/Beitragsfelder (idempotent):
//   iban, bic, mandatsref, mandatsdatum, beitrag_monatlich
// Pflege spaeter in der Mitgliederverwaltung.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

async function ensureFeld(feld) {
  const col = await pb.collections.getOne('users');
  if ((col.fields ?? []).some((f) => f.name === feld.name)) {
    console.log('users: Feld vorhanden:', feld.name);
    return;
  }
  await pb.collections.update('users', { fields: [...col.fields, feld] });
  console.log('users: Feld ergaenzt:', feld.name);
}

await ensureFeld({ name: 'iban', type: 'text' });
await ensureFeld({ name: 'bic', type: 'text' });
await ensureFeld({ name: 'mandatsref', type: 'text' });
await ensureFeld({ name: 'mandatsdatum', type: 'date' });
await ensureFeld({ name: 'beitrag_monatlich', type: 'number' });

// Demo: einem Dummy-Mitglied ein Mandat geben, damit der Export testbar ist.
try {
  const anna = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-101"');
  if (!anna.iban) {
    await pb.collection('users').update(anna.id, {
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      mandatsref: 'MANDAT-M-101',
      mandatsdatum: '2026-05-01 00:00:00.000Z',
      beitrag_monatlich: 15,
    });
    console.log('Demo-Mandat fuer M-101 gesetzt.');
  }
} catch {
  /* kein Dummy vorhanden - egal */
}

console.log('Fertig. SEPA-Felder eingerichtet.');
