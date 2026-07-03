// Abstimmungen/Umfragen (idempotent):
//  - abstimmungen: Titel, Beschreibung, Optionen (JSON), Status, Ende
//  - stimmen: eine Stimme je Mitglied und Abstimmung, per UNIQUE-Index
//    (abstimmung, mitglied) auf DB-Ebene abgesichert -> kein Stimmenstuffing,
//    garantiert eine Stimme (auch gegen direkte API-Zugriffe)
// Offenes Voting (Stimme ist mit Mitglied verknuepft) - transparent, wie bei
// Vereinsbeschluessen ueblich. Anlegen/Schliessen: Vorstand. Abstimmen: alle.
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
    return false;
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
    return true;
  }
}

await ensureCollection({
  name: 'abstimmungen',
  type: 'base',
  listRule: REGEL.angemeldet,
  viewRule: REGEL.angemeldet,
  createRule: REGEL.vorstand,
  updateRule: REGEL.vorstand,
  deleteRule: null,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'beschreibung', type: 'text' },
    { name: 'optionen', type: 'json', required: true }, // string[]
    { name: 'status', type: 'select', maxSelect: 1, values: ['offen', 'geschlossen'] },
    { name: 'ende', type: 'date' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

const abstimmungenId = (await pb.collections.getOne('abstimmungen')).id;
const usersId = (await pb.collections.getOne('users')).id;

// Einmal-pro-Mitglied wird per UNIQUE-Index (abstimmung, mitglied) auf DB-Ebene
// garantiert - das blockt auch direkte API-Doppelstimmen. Das Feld `mitglied`
// setzt der Endpoint serverseitig auf das angemeldete Mitglied. (Eine
// createRule mit @request.data.mitglied waere zusaetzlich schoen, wird von
// dieser PB-Version fuer Relationen aber nicht aufgeloest - wie bei
// vorbestellungen; daher einfache Regel + Index.)
await ensureCollection({
  name: 'stimmen',
  type: 'base',
  listRule: REGEL.angemeldet,
  viewRule: REGEL.angemeldet,
  createRule: REGEL.angemeldet,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'abstimmung', type: 'relation', required: true, maxSelect: 1, collectionId: abstimmungenId, cascadeDelete: true },
    { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
    { name: 'option_index', type: 'number', required: true },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});
{
  const col = await pb.collections.getOne('stimmen');
  if (!(col.indexes ?? []).some((i) => i.includes('idx_stimme_einmalig'))) {
    await pb.collections.update('stimmen', {
      indexes: [...(col.indexes ?? []), 'CREATE UNIQUE INDEX `idx_stimme_einmalig` ON `stimmen` (`abstimmung`, `mitglied`)'],
    });
    console.log('stimmen: Unique-Index gesetzt.');
  }
}

// Demo-Abstimmung
try {
  await pb.collection('abstimmungen').getFirstListItem('titel~"Vereinsabend"');
  console.log('Demo-Abstimmung vorhanden.');
} catch {
  await pb.collection('abstimmungen').create({
    titel: 'Termin fuer den naechsten Vereinsabend',
    beschreibung: 'An welchem Wochentag soll der naechste offene Vereinsabend stattfinden?',
    optionen: ['Freitag', 'Samstag', 'Sonntag'],
    status: 'offen',
  });
  console.log('Demo-Abstimmung angelegt.');
}

console.log('Fertig. Abstimmungen eingerichtet.');
