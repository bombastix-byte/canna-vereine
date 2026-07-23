import PocketBase from 'pocketbase';
import { berlinTag, berlinMonat } from '../src/lib/ausgabe.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('users').authWithPassword(STAFF, STAFF_PW);

const ziel = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-107"');
const tag = berlinTag();
const monat = berlinMonat(tag);
const basis = {
  mitglied: ziel.id,
  mitgliedsnummer: 'M-107',
  sorte_name: 'Hook-Test',
  charge: 'HOOK-TEST',
  thc_prozent: 9,
  cbd_prozent: 1,
  beitrag_euro: 0,
  abgegeben_von: pb.authStore.record.id,
  belegnr: `HOOK-${Date.now()}`,
  tag: '2020-01-01',
  monat: '2020-01',
};

let fehler = 0;
try {
  await pb.collection('ausgaben').create({ ...basis, menge_gramm: 999 });
  console.log('FAIL  Direkte PB-API blockt 999 g nicht');
  fehler++;
} catch (e) {
  const ok = e?.status === 400;
  console.log(`${ok ? 'PASS' : 'FAIL'}  Direkte PB-API blockt 999 g`);
  if (!ok) fehler++;
}

const legitim = await pb.collection('ausgaben').create({
  ...basis,
  belegnr: `HOOK-OK-${Date.now()}`,
  menge_gramm: 1,
});
const datumOk = legitim.tag === tag && legitim.monat === monat;
console.log(`${datumOk ? 'PASS' : 'FAIL'}  Hook ueberschreibt manipuliertes Datum mit Berlin-Tag`);
if (!datumOk) fehler++;

if (fehler) process.exit(1);
console.log('\nKCanG-HOOK-E2E BESTANDEN');
