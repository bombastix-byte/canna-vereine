// Weiterverarbeitung (Haschisch/Rosin) einrichten (idempotent).
//  - chargen: Feld `produkt_typ` (bluete/haschisch/rosin; leer = bluete)
//  - ausgaben: Feld `produkt_typ` (Snapshot fuer Beleg + Jahresmeldung)
//  - Collection `verarbeitungen` (append-only Protokoll Quelle -> Produkt)
//  - Demo: eine Haschisch-Charge aus einer freigegebenen Bluete-Charge
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';
import { chargeNr } from '../src/lib/wawi.ts';
import { PRODUKT_TYPEN } from '../src/lib/verarbeitung.ts';
import { berlinTag } from '../src/lib/ausgabe.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

async function ensureFeld(collection, feld) {
  const col = await pb.collections.getOne(collection);
  if ((col.fields ?? []).some((f) => f.name === feld.name)) return false;
  await pb.collections.update(collection, { fields: [...col.fields, feld] });
  console.log(`${collection}: Feld ${feld.name} ergaenzt.`);
  return true;
}

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

// ---------- Felder ----------
await ensureFeld('chargen', { name: 'produkt_typ', type: 'select', maxSelect: 1, values: [...PRODUKT_TYPEN] });
await ensureFeld('ausgaben', { name: 'produkt_typ', type: 'text' });

// ---------- Protokoll Verarbeitungen ----------
const chargenId = (await pb.collections.getOne('chargen')).id;
const usersId = (await pb.collections.getOne('users')).id;
await ensureCollection({
  name: 'verarbeitungen',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: null, // append-only
  deleteRule: null,
  fields: [
    { name: 'quelle_ref', type: 'relation', maxSelect: 1, collectionId: chargenId, cascadeDelete: false },
    { name: 'quelle_nr', type: 'text' },
    { name: 'sorte_name', type: 'text' },
    { name: 'produkt_typ', type: 'text', required: true }, // haschisch | rosin
    { name: 'einsatz_g', type: 'number', required: true },
    { name: 'ertrag_g', type: 'number', required: true },
    { name: 'produkt_ref', type: 'relation', maxSelect: 1, collectionId: chargenId, cascadeDelete: false },
    { name: 'produkt_nr', type: 'text' },
    { name: 'datum', type: 'text' }, // 'YYYY-MM-DD'
    { name: 'durchgefuehrt_von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

// ---------- Demo: eine Haschisch-Charge aus einer Bluete-Charge ----------
const vorhandene = await pb.collection('verarbeitungen').getFullList();
if (vorhandene.length > 0) {
  console.log(`Demo uebersprungen (${vorhandene.length} Verarbeitungen vorhanden).`);
} else {
  const quellen = await pb
    .collection('chargen')
    .getFullList({ filter: 'status="freigegeben"', sort: 'charge_nr' });
  const quelle = quellen.find((c) => !c.produkt_typ || c.produkt_typ === 'bluete');
  if (!quelle || (quelle.verfuegbar_g ?? 0) < 60) {
    console.log('Keine passende freigegebene Bluete-Charge fuer die Demo gefunden - uebersprungen.');
  } else {
    const tag = berlinTag();
    const jahr = tag.slice(0, 4);
    const anzahlJahr = (await pb.collection('chargen').getFullList()).filter((c) =>
      String(c.charge_nr ?? '').startsWith(jahr + '-'),
    ).length;
    const einsatz = 50;
    const ertrag = 8;
    const produkt = await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, anzahlJahr),
      sorte: quelle.sorte,
      sorte_name: quelle.sorte_name,
      status: 'freigegeben',
      produkt_typ: 'haschisch',
      herkunft: `Verarbeitung aus Charge ${quelle.charge_nr}`,
      trockengewicht_g: ertrag,
      verfuegbar_g: ertrag,
      thc_prozent: 32,
      cbd_prozent: 1,
      notiz: 'Demo: Trockensieb-Haschisch',
    });
    await pb.collection('verarbeitungen').create({
      quelle_ref: quelle.id,
      quelle_nr: quelle.charge_nr,
      sorte_name: quelle.sorte_name,
      produkt_typ: 'haschisch',
      einsatz_g: einsatz,
      ertrag_g: ertrag,
      produkt_ref: produkt.id,
      produkt_nr: produkt.charge_nr,
      datum: tag,
      notiz: 'Demo-Verarbeitung',
    });
    await pb.collection('chargen').update(quelle.id, {
      verfuegbar_g: Math.max(0, Number(quelle.verfuegbar_g) - einsatz),
    });
    console.log(`Demo-Verarbeitung angelegt: ${quelle.charge_nr} -> ${produkt.charge_nr} (Haschisch, ${ertrag} g).`);
  }
}

console.log('seed-verarbeitung fertig.');
