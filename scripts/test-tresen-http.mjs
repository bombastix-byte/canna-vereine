// End-to-End-Test des Tresens ueber HTTP: meldet sich als Personal an und bucht
// echte Szenarien gegen den laufenden Astro-Dev-Server + PocketBase. Setzt seinen
// Startzustand selbst (loescht Abgaben, legt Anna mit 22 g heute an), damit der
// Lauf deterministisch ist. Voraussetzung: PB (8090) + astro dev (4321) + Seeds.
import PocketBase from 'pocketbase';
import { berlinTag, berlinMonat, beitragEuro } from '../src/lib/ausgabe.ts';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
const uid = async (nr) => (await pb.collection('users').getFirstListItem(`mitgliedsnummer="${nr}"`)).id;
const chargeVon = async (sorteName) =>
  (await pb.collection('chargen').getFirstListItem(`sorte_name="${sorteName}" && status="freigegeben"`)).id;
const anna = await uid('M-101');
const bengt = await uid('M-102'); // frisch, fuer Multi-Positions-Tests
const david = await uid('M-104'); // U21 (2007)
const hugo = await uid('M-108'); // ohne Geburtsdatum -> als U21
const chNL = await chargeVon('Gushers'); // 26 % THC
const chCBD = await chargeVon('CBD Aurora'); // 9 % THC

// Deterministischer Startzustand: Abgaben leeren, Anna 22 g heute setzen.
const heute = berlinTag();
const monat = berlinMonat(heute);
for (const a of await pb.collection('ausgaben').getFullList()) await pb.collection('ausgaben').delete(a.id);
await pb.collection('ausgaben').create({
  mitglied: anna, mitgliedsnummer: 'M-101', sorte_name: 'Gushers',
  menge_gramm: 22, beitrag_euro: beitragEuro(22), tag: heute, monat, belegnr: 'RESET',
});

const login = await fetch(`${BASE}/mitglieder/anmelden`, {
  method: 'POST', redirect: 'manual',
  headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: STAFF, passwort: STAFF_PW }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
if (!cookie) { console.log('LOGIN FEHLGESCHLAGEN', login.status); process.exit(1); }
console.log('Personal angemeldet.\n');

async function buchen(mitglied, charge, menge) {
  const r = await fetch(`${BASE}/mitglieder/ausgabe/buchen`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ mitglied, charge, menge_gramm: String(menge) }),
  });
  return r.headers.get('location') ?? '';
}

async function buchenMulti(mitglied, positionen) {
  const body = new URLSearchParams({ mitglied });
  positionen.forEach((p, i) => {
    body.set(`charge_${i + 1}`, p.charge);
    body.set(`menge_${i + 1}`, String(p.menge));
  });
  const r = await fetch(`${BASE}/mitglieder/ausgabe/buchen`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie },
    body,
  });
  return r.headers.get('location') ?? '';
}
let fehler = 0;
function pruefe(name, loc, enthaelt) {
  const ok = loc.includes(enthaelt);
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      -> ${decodeURIComponent(loc)}`);
}

pruefe('Anna (22g heute) + 5g -> Tageslimit blockt', await buchen(anna, chNL, 5), 'Tageslimit');
pruefe('David (U21) + Charge 26% THC -> blockt', await buchen(david, chNL, 5), 'THC');
pruefe('David (U21) + Charge 9% THC -> Beleg', await buchen(david, chCBD, 5), '/beleg/');
pruefe('Hugo (kein Geb.dat) + 26% THC -> blockt (als U21)', await buchen(hugo, chNL, 5), 'THC');
pruefe('Anna (22g heute) + 3g -> Beleg (genau 25)', await buchen(anna, chNL, 3), '/beleg/');

// --- Mehrere Sorten in EINEM Vorgang (gemeinsamer Beleg) ---
const multiLoc = await buchenMulti(bengt, [
  { charge: chNL, menge: 3 },
  { charge: chCBD, menge: 2 },
]);
pruefe('Bengt Multi (3g NL + 2g CBD) -> Beleg', multiLoc, '/beleg/');
// Beide Zeilen muessen dieselbe Belegnummer teilen.
const belegId = multiLoc.split('/beleg/')[1]?.split('?')[0];
if (belegId) {
  const erster = await pb.collection('ausgaben').getOne(belegId);
  const gruppe = await pb.collection('ausgaben').getFullList({
    filter: `belegnr="${erster.belegnr}" && mitglied="${bengt}"`,
  });
  pruefe('Multi: 2 Zeilen mit gleicher Belegnr', String(gruppe.length), '2');
  pruefe('Multi: Gesamtmenge 5 g', String(gruppe.reduce((s, r) => s + r.menge_gramm, 0)), '5');
}
// Summe ueber Tageslimit muss blocken (Bengt hat jetzt 5 g heute -> Rest 20).
pruefe('Bengt Multi (15g + 10g = 25g, Rest 20) -> Tageslimit', await buchenMulti(bengt, [
  { charge: chNL, menge: 15 },
  { charge: chCBD, menge: 10 },
]), 'Tageslimit');

console.log(`\n${fehler === 0 ? 'HTTP-E2E TRESEN BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
