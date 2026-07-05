// Gibt dem Ausgabe-Team/Vorstand Schreibrechte auf das "Angebot der Woche",
// damit es direkt in der App gepflegt werden kann (statt nur per Skript).
// Idempotent.
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

// Feld sorten (JSON-Liste) sicherstellen - aeltere DBs hatten es evtl. nicht.
const col = await pb.collections.getOne('wochenangebot');
if (!(col.fields ?? []).some((f) => f.name === 'sorten')) {
  await pb.collections.update('wochenangebot', {
    fields: [...col.fields, { name: 'sorten', type: 'json', maxSize: 2000000 }],
  });
  console.log('wochenangebot: Feld sorten ergaenzt.');
} else {
  console.log('wochenangebot: Feld sorten vorhanden.');
}

await pb.collections.update('wochenangebot', {
  createRule: REGEL.ausgabe,
  updateRule: REGEL.ausgabe,
  deleteRule: REGEL.ausgabe,
});
console.log('wochenangebot: Schreibrechte fuer Ausgabe/Vorstand gesetzt.');
