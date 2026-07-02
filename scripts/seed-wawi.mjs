// Richtet die Warenwirtschaft + das Mehrfach-Rollenmodell ein (idempotent).
//  - users: Feld `rollen` (Mehrfach-Auswahl), migriert altes `rolle`
//  - Regeln aller Compliance-Collections auf `rollen` umgestellt
//  - Collections `chargen` (Anbaulos-Lebenszyklus) und `vernichtungen`
//  - ausgaben um Referenz `charge_ref` erweitert (Rueckverfolgbarkeit)
//  - Demo-Chargen (freigegeben + im Anbau + geerntet) + Anbau-Demo-Nutzer
import PocketBase from 'pocketbase';
import { ROLLEN, REGEL } from '../src/lib/rollen.ts';
import { chargeNr } from '../src/lib/wawi.ts';
import { berlinTag } from '../src/lib/ausgabe.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

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

async function ensureFeld(collection, feld) {
  const col = await pb.collections.getOne(collection);
  if ((col.fields ?? []).some((f) => f.name === feld.name)) return false;
  await pb.collections.update(collection, { fields: [...col.fields, feld] });
  console.log(`${collection}: Feld ${feld.name} ergaenzt.`);
  return true;
}

// ---------- users: Mehrfach-Rollen ----------
await ensureFeld('users', { name: 'rollen', type: 'select', maxSelect: ROLLEN.length, values: ROLLEN });

// Altes Einzelfeld `rolle` in `rollen` migrieren, wo noch leer.
{
  const alle = await pb.collection('users').getFullList();
  let migriert = 0;
  for (const u of alle) {
    const hat = Array.isArray(u.rollen) ? u.rollen : [];
    if (hat.length === 0) {
      const rollen = u.rolle ? [u.rolle] : ['mitglied'];
      await pb.collection('users').update(u.id, { rollen });
      migriert++;
    }
  }
  console.log(`rollen migriert fuer ${migriert} Nutzer.`);
}

// Sichtbarkeit der Mitglieder fuer Personal (Tresen/Anbau/Vorstand).
const mitgliedSicht =
  '@request.auth.id != "" && (id = @request.auth.id || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "vorstand")';
await pb.collections.update('users', { listRule: mitgliedSicht, viewRule: mitgliedSicht });

// ---------- Regeln bestehender Collections auf rollen umstellen ----------
const sichtbarAusgaben =
  '@request.auth.id != "" && (mitglied = @request.auth.id || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand")';
await pb.collections.update('ausgaben', {
  createRule: REGEL.ausgabe,
  listRule: sichtbarAusgaben,
  viewRule: sichtbarAusgaben,
});
await pb.collections.update('sorten', { updateRule: REGEL.anbau });
console.log('Regeln (ausgaben/sorten) auf rollen umgestellt.');

// ---------- Chargen (Anbaulos-Lebenszyklus) ----------
const sortenId = (await pb.collections.getOne('sorten')).id;
await ensureCollection({
  name: 'chargen',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: REGEL.wareSchreiben, // Anbau pflegt Lebenszyklus; Ausgabe schreibt Bestand fort
  deleteRule: null,
  fields: [
    { name: 'charge_nr', type: 'text', required: true },
    { name: 'sorte', type: 'relation', required: true, maxSelect: 1, collectionId: sortenId, cascadeDelete: false },
    { name: 'sorte_name', type: 'text' }, // denormalisiert fuer Anzeige/Snapshot
    { name: 'status', type: 'select', maxSelect: 1, values: ['anbau', 'geerntet', 'freigegeben', 'gesperrt', 'aufgebraucht'] },
    { name: 'herkunft', type: 'text' }, // Samen/Stecklinge + Bezugsquelle
    { name: 'pflanzenzahl', type: 'number' },
    { name: 'anbau_start', type: 'date' },
    { name: 'ernte_datum', type: 'date' },
    { name: 'frischgewicht_g', type: 'number' },
    { name: 'trockengewicht_g', type: 'number' },
    { name: 'verfuegbar_g', type: 'number' },
    { name: 'thc_prozent', type: 'number' },
    { name: 'cbd_prozent', type: 'number' },
    { name: 'standort', type: 'text' },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});
const chargenId = (await pb.collections.getOne('chargen')).id;

// ausgaben um Charge-Referenz erweitern (Rueckverfolgbarkeit Abgabe -> Anbaulos).
await ensureFeld('ausgaben', {
  name: 'charge_ref',
  type: 'relation',
  maxSelect: 1,
  collectionId: chargenId,
  cascadeDelete: false,
});

// ---------- Vernichtungen (dokumentationspflichtig) ----------
await ensureCollection({
  name: 'vernichtungen',
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
    { name: 'grund', type: 'text' },
    { name: 'datum', type: 'text' }, // 'YYYY-MM-DD'
    { name: 'durchgefuehrt_von', type: 'relation', maxSelect: 1, collectionId: (await pb.collections.getOne('users')).id, cascadeDelete: false },
    { name: 'zeuge', type: 'text' },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

// ---------- Anbau-Demo-Nutzer ----------
async function ensureUser(email, password, patch) {
  try {
    const u = await pb.collection('users').getFirstListItem(`email="${email}"`);
    await pb.collection('users').update(u.id, patch);
    return u;
  } catch {
    return pb.collection('users').create({ email, password, passwordConfirm: password, verified: true, ...patch });
  }
}
await ensureUser(ANBAU, ANBAU_PW, {
  name: 'Demo Anbau',
  mitgliedsnummer: 'G-001',
  geburtsdatum: '1983-04-04 00:00:00.000Z',
  rollen: ['anbau'],
});
console.log('Anbau-Demo-Nutzer:', ANBAU, '/', ANBAU_PW);

// ---------- Demo-Chargen ----------
const jahr = berlinTag().slice(0, 4);
async function sorteVon(name) {
  try {
    return await pb.collection('sorten').getFirstListItem(`name="${name}"`);
  } catch {
    return null;
  }
}

const bestand = await pb.collection('chargen').getList(1, 1);
if (bestand.totalItems > 0) {
  console.log('Chargen vorhanden, ueberspringe Demo.');
} else {
  const cbd = await sorteVon('CBD Aurora');
  const nl = await sorteVon('Northern Lights');
  const lh = await sorteVon('Lemon Haze');
  const demo = [
    cbd && { sorte: cbd, status: 'freigegeben', frisch: 1500, trocken: 400, verf: 400, thc: 9, cbd_p: 8, herkunft: 'Stecklinge, Mutterpflanze intern' },
    nl && { sorte: nl, status: 'freigegeben', frisch: 2400, trocken: 600, verf: 600, thc: 18, cbd_p: 0.6, herkunft: 'Samen, Fachhandel' },
    lh && { sorte: lh, status: 'freigegeben', frisch: 2000, trocken: 500, verf: 500, thc: 20, cbd_p: 0.4, herkunft: 'Samen, Fachhandel' },
    nl && { sorte: nl, status: 'geerntet', frisch: 2100, trocken: null, verf: null, thc: null, cbd_p: null, herkunft: 'Samen, Fachhandel' },
    cbd && { sorte: cbd, status: 'anbau', frisch: null, trocken: null, verf: null, thc: null, cbd_p: null, herkunft: 'Stecklinge, Mutterpflanze intern' },
  ].filter(Boolean);

  let i = 0;
  for (const d of demo) {
    i++;
    await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, i - 1),
      sorte: d.sorte.id,
      sorte_name: d.sorte.name,
      status: d.status,
      herkunft: d.herkunft,
      pflanzenzahl: 12,
      anbau_start: `${jahr}-04-01 00:00:00.000Z`,
      ernte_datum: d.status === 'anbau' ? null : `${jahr}-06-15 00:00:00.000Z`,
      frischgewicht_g: d.frisch ?? null,
      trockengewicht_g: d.trocken ?? null,
      verfuegbar_g: d.verf ?? null,
      thc_prozent: d.thc ?? null,
      cbd_prozent: d.cbd_p ?? null,
      standort: 'Anbauraum 1',
      notiz: '',
    });
  }
  console.log('Demo-Chargen angelegt:', demo.length);
}

console.log('\nFertig. Warenwirtschaft + Rollen eingerichtet.');
