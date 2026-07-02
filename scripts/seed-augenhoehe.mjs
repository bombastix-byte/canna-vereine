// "Augenhoehe-Paket" (idempotent):
//  - Collection `transporte` (Transportbescheinigungen nach Paragraf 22 KCanG)
//  - Collection `antraege` (Beitritts-/Wartelisten-Workflow, oeffentlicher Antrag)
//  - chargen um `coa` (Laborzertifikat-Datei) + `testergebnis_url` erweitert
//  - users um `beitrag_bis` (Beitrag bezahlt bis) erweitert
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
async function ensureFeld(collection, feld) {
  const col = await pb.collections.getOne(collection);
  if ((col.fields ?? []).some((f) => f.name === feld.name)) return;
  await pb.collections.update(collection, { fields: [...col.fields, feld] });
  console.log(`${collection}: Feld ${feld.name} ergaenzt.`);
}

const usersId = (await pb.collections.getOne('users')).id;
const chargenId = (await pb.collections.getOne('chargen')).id;

// ---------- Transportbescheinigungen (Paragraf 22 Abs. 3 KCanG) ----------
// Append-only Protokoll; anlegen darf Anbau/Vorstand, lesen das Personal.
await ensureCollection({
  name: 'transporte',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'charge_ref', type: 'relation', maxSelect: 1, collectionId: chargenId, cascadeDelete: false },
    { name: 'charge_nr', type: 'text' },
    { name: 'sorte_name', type: 'text' },
    { name: 'menge_gramm', type: 'number', required: true },
    { name: 'von', type: 'text', required: true },
    { name: 'nach', type: 'text', required: true },
    { name: 'datum', type: 'text', required: true }, // 'YYYY-MM-DD'
    { name: 'person', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'person_name', type: 'text' }, // Snapshot fuer die Bescheinigung
    { name: 'zweck', type: 'text' },
    { name: 'belegnr', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

// ---------- Beitrittsantraege / Warteliste ----------
// Anlegen ist oeffentlich (Antrag von der Website); sehen/bearbeiten nur Vorstand.
await ensureCollection({
  name: 'antraege',
  type: 'base',
  listRule: REGEL.vorstand,
  viewRule: REGEL.vorstand,
  createRule: '', // oeffentliches Formular; Server-Endpoint validiert zusaetzlich
  updateRule: REGEL.vorstand,
  deleteRule: null,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'telefon', type: 'text' },
    { name: 'geburtsdatum', type: 'text' }, // 'YYYY-MM-DD' (Selbstauskunft)
    { name: 'nachricht', type: 'text' },
    { name: 'status', type: 'select', maxSelect: 1, values: ['offen', 'warteliste', 'aufgenommen', 'abgelehnt'] },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// ---------- Charge: Laborzertifikat + eigener Testergebnis-Link ----------
await ensureFeld('chargen', {
  name: 'coa',
  type: 'file',
  maxSelect: 1,
  maxSize: 10485760,
  mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
});
await ensureFeld('chargen', { name: 'testergebnis_url', type: 'url' });

// ---------- Mitglied: Beitrag bezahlt bis ----------
await ensureFeld('users', { name: 'beitrag_bis', type: 'date' });

console.log('\nFertig. Augenhoehe-Paket eingerichtet.');
