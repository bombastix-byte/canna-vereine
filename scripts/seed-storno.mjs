// Storno-Felder fuer Abgaben: stornierte Abgaben zaehlen nicht mehr in Limits,
// Kasse und Jahresmeldung; der Datensatz bleibt (append-only, nachvollziehbar).
// Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;
const col = await pb.collections.getOne('ausgaben');
const hat = (n) => (col.fields ?? []).some((f) => f.name === n);
const neu = [];
if (!hat('storniert')) neu.push({ name: 'storniert', type: 'bool' });
if (!hat('storniert_am')) neu.push({ name: 'storniert_am', type: 'text' });
if (!hat('storno_grund')) neu.push({ name: 'storno_grund', type: 'text' });
if (!hat('storniert_von')) neu.push({ name: 'storniert_von', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false });

if (neu.length) {
  await pb.collections.update('ausgaben', { fields: [...col.fields, ...neu] });
  console.log('ausgaben: Felder ergaenzt:', neu.map((f) => f.name).join(', '));
} else {
  console.log('ausgaben: Storno-Felder bereits vorhanden.');
}

// Append-only: Personal darf ausschliesslich einen noch aktiven Satz stornieren.
// Alle fachlichen Snapshot-Felder bleiben auch ueber die direkte PB-API gesperrt.
const stornoRegel = '(@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand") && storniert != true && @request.body.storniert = true && @request.body.mitglied:isset = false && @request.body.mitgliedsnummer:isset = false && @request.body.sorte:isset = false && @request.body.sorte_name:isset = false && @request.body.charge:isset = false && @request.body.charge_ref:isset = false && @request.body.produkt_typ:isset = false && @request.body.thc_prozent:isset = false && @request.body.cbd_prozent:isset = false && @request.body.menge_gramm:isset = false && @request.body.beitrag_euro:isset = false && @request.body.tag:isset = false && @request.body.monat:isset = false && @request.body.abgegeben_von:isset = false && @request.body.belegnr:isset = false && @request.body.notiz:isset = false';

const pflichtIndexe = [
  'CREATE INDEX idx_ausgaben_mitglied_monat ON ausgaben (mitglied, monat)',
  'CREATE INDEX idx_ausgaben_tag ON ausgaben (tag)',
  'CREATE INDEX idx_ausgaben_belegnr ON ausgaben (belegnr)',
];
const fremdeIndexe = (col.indexes ?? []).filter((index) =>
  !pflichtIndexe.some((pflicht) => index.includes(pflicht.split(' ')[2])),
);
await pb.collections.update('ausgaben', {
  updateRule: stornoRegel,
  indexes: [...fremdeIndexe, ...pflichtIndexe],
});
console.log('ausgaben: append-only-Stornoregel + Pflichtindexe gesetzt.');
