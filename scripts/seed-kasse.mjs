// Kassenbuch: Bewegungen (Einlage/Entnahme) + Tagesabschluss. Nur Ausgabe/
// Vorstand. Append-only (keine Aenderung/Loeschung). Idempotent.
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
  }
}

const usersId = (await pb.collections.getOne('users')).id;

await ensureCollection({
  name: 'kassenbewegung',
  type: 'base',
  listRule: REGEL.ausgabe,
  viewRule: REGEL.ausgabe,
  createRule: REGEL.ausgabe,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'datum', type: 'text', required: true }, // YYYY-MM-DD
    { name: 'typ', type: 'select', maxSelect: 1, required: true, values: ['einlage', 'entnahme'] },
    { name: 'betrag_euro', type: 'number', required: true },
    { name: 'zweck', type: 'text' },
    { name: 'von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

await ensureCollection({
  name: 'kassenabschluss',
  type: 'base',
  listRule: REGEL.ausgabe,
  viewRule: REGEL.ausgabe,
  createRule: REGEL.ausgabe,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'datum', type: 'text', required: true }, // YYYY-MM-DD (ein Abschluss je Tag)
    { name: 'beitraege_euro', type: 'number' }, // Summe Abgabe-Beitraege
    { name: 'einlagen_euro', type: 'number' },
    { name: 'entnahmen_euro', type: 'number' },
    { name: 'erwartet_euro', type: 'number' }, // beitraege + einlagen - entnahmen
    { name: 'gezaehlt_euro', type: 'number', required: true },
    { name: 'differenz_euro', type: 'number' }, // gezaehlt - erwartet
    { name: 'notiz', type: 'text' },
    { name: 'von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

console.log('seed-kasse fertig.');
