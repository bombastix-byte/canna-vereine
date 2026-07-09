// Erweiterungen (idempotent): Collection fuer Vermehrungsmaterial-Weitergaben
// und Schreibrecht des Vorstands auf users (fuer die Mitglieder-/Rollenverwaltung).
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
const sichtbar =
  '@request.auth.id != "" && (mitglied = @request.auth.id || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand")';

await ensureCollection({
  name: 'vermehrung_ausgaben',
  type: 'base',
  listRule: sichtbar,
  viewRule: sichtbar,
  createRule: REGEL.ausgabe,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'mitglied', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'mitgliedsnummer', type: 'text' },
    { name: 'art', type: 'select', maxSelect: 1, values: ['samen', 'stecklinge'] },
    { name: 'anzahl', type: 'number', required: true },
    { name: 'tag', type: 'text', required: true },
    { name: 'monat', type: 'text', required: true },
    { name: 'abgegeben_von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'belegnr', type: 'text' },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// Vorstand darf Mitglieder pflegen (Rollen/Stammdaten in der Verwaltung).
// NUR setzen, wenn noch keine Regel existiert - sonst wuerde die feinere
// Selbstverwaltungs-Regel (seed-selbstverwaltung.mjs) ueberschrieben.
const usersColRegel = await pb.collections.getOne('users');
if (!usersColRegel.updateRule) {
  await pb.collections.update('users', { updateRule: REGEL.vorstand });
  console.log('users.updateRule = Vorstand gesetzt.');
} else {
  console.log('users.updateRule vorhanden - unangetastet.');
}

console.log('\nFertig. Erweiterungen eingerichtet.');
