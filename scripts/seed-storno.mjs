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

// Storno braucht eine updateRule: bisher war ausgaben append-only (updateRule null).
// Personal (Ausgabe/Vorstand) darf Abgaben korrigieren/stornieren.
const staffRegel = '@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"';
if (col.updateRule !== staffRegel) {
  await pb.collections.update('ausgaben', { updateRule: staffRegel });
  console.log('ausgaben: updateRule fuer Personal gesetzt (Storno/Korrektur).');
} else {
  console.log('ausgaben: updateRule bereits gesetzt.');
}
