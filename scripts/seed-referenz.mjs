// "Referenz-Paket" (idempotent): Zwei-Faktor-Anmeldung + Pflanzen-Ebene.
//  - Collection `zweifaktor` (TOTP-Geheimnis je Mitglied, nur selbst lesbar)
//  - Collection `pflanzen` (Einzelpflanzen je Charge: wachsend/geerntet/vernichtet)
//  - vernichtungen: menge_gramm optional + Stueck-Felder (Pflanzen vor der Ernte)
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

// ---------- Zwei-Faktor (TOTP) ----------
// Jedes Mitglied sieht/pflegt NUR den eigenen Datensatz - auch Personal kann
// fremde Geheimnisse nicht lesen. Die strenge Anlege-Regel wird nachgezogen
// (Feld-Referenzen erst nach Anlage moeglich, bekanntes PB-Muster).
const eigenes = '@request.auth.id != "" && user = @request.auth.id';
await ensureCollection({
  name: 'zweifaktor',
  type: 'base',
  listRule: eigenes,
  viewRule: eigenes,
  createRule: '@request.auth.id != ""',
  updateRule: eigenes,
  deleteRule: null,
  fields: [
    { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
    { name: 'secret', type: 'text', required: true },
    { name: 'aktiv', type: 'bool' },
    { name: 'letzter_schritt', type: 'number' }, // Replay-Schutz: zuletzt genutzter Zeitschritt
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});
try {
  await pb.collections.update('zweifaktor', {
    createRule: '@request.auth.id != "" && @request.data.user = @request.auth.id',
  });
  console.log('zweifaktor: strenge Anlege-Regel gesetzt.');
} catch (e) {
  console.log('Hinweis: strenge Anlege-Regel nicht gesetzt:', e?.message ?? e);
}

// ---------- Pflanzen-Ebene ----------
// Einzelpflanzen je Charge; pflegen darf Anbau/Vorstand, lesen das Personal.
await ensureCollection({
  name: 'pflanzen',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: REGEL.anbau,
  deleteRule: null,
  fields: [
    { name: 'charge_ref', type: 'relation', required: true, maxSelect: 1, collectionId: chargenId, cascadeDelete: true },
    { name: 'nummer', type: 'text', required: true }, // z. B. 2026-0001-P03
    { name: 'status', type: 'select', maxSelect: 1, values: ['wachsend', 'geerntet', 'vernichtet'] },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

// ---------- Vernichtungen: Stueck-Vernichtung vor der Ernte ----------
// menge_gramm wird optional (eine Jungpflanze hat kein dokumentiertes Gewicht),
// dafuer kommen Stueckzahl + Pflanzen-Nummern dazu.
{
  const col = await pb.collections.getOne('vernichtungen');
  const felder = col.fields.map((f) => (f.name === 'menge_gramm' ? { ...f, required: false } : f));
  await pb.collections.update('vernichtungen', { fields: felder });
  console.log('vernichtungen: menge_gramm ist jetzt optional.');
}
await ensureFeld('vernichtungen', { name: 'anzahl_pflanzen', type: 'number' });
await ensureFeld('vernichtungen', { name: 'pflanzen_nrn', type: 'text' });

// ---------- Bestehende Chargen: Pflanzen nachziehen ----------
// Fuer Chargen mit pflanzenzahl aber ohne Pflanzen-Datensaetze (Demo/Altbestand).
const chargen = await pb.collection('chargen').getFullList();
for (const c of chargen) {
  const n = Number(c.pflanzenzahl) || 0;
  if (n <= 0) continue;
  const vorhandene = await pb.collection('pflanzen').getList(1, 1, { filter: `charge_ref="${c.id}"` });
  if (vorhandene.totalItems > 0) continue;
  const status = c.status === 'anbau' ? 'wachsend' : 'geerntet';
  for (let i = 1; i <= n; i++) {
    await pb.collection('pflanzen').create({
      charge_ref: c.id,
      nummer: `${c.charge_nr}-P${String(i).padStart(2, '0')}`,
      status,
    });
  }
  console.log(`Pflanzen nachgezogen: ${c.charge_nr} (${n} Stueck, ${status})`);
}

console.log('\nFertig. Referenz-Paket eingerichtet.');
