// Legt Dummy-Mitglieder mit verschiedenen Altersstufen an (inkl. zwei unter 21
// und eines ohne Geburtsdatum) plus etwas Tagesumsatz, damit sich der Tresen
// realistisch durchklicken laesst. Idempotent. Reines Testwerkzeug.
import PocketBase from 'pocketbase';
import { berlinTag, berlinMonat, beitragEuro } from '../src/lib/ausgabe.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';
const SITE_ID = process.env.SITE_ID ?? 'goerlitz';
const loginEmail = (nummer) => `${String(nummer).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}@${SITE_ID}.local`;

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const tag = berlinTag();
const monat = berlinMonat(tag);

// email, name, mitgliedsnummer, geburtsdatum (oder null)
const leute = [
  ['anna@dummy.local', 'Anna Berg', 'M-101', '1988-02-14'],
  ['bengt@dummy.local', 'Bengt Cordes', 'M-102', '1995-11-30'],
  ['clara@dummy.local', 'Clara Diehl', 'M-103', '2006-01-10'], // ~20 -> U21
  ['david@dummy.local', 'David Ernst', 'M-104', '2007-09-20'], // ~18 -> U21
  ['eva@dummy.local', 'Eva Fuchs', 'M-105', '1979-06-05'],
  ['falk@dummy.local', 'Falk Gross', 'M-106', '2000-12-01'],
  ['greta@dummy.local', 'Greta Hahn', 'M-107', '1992-03-03'],
  ['hugo@dummy.local', 'Hugo Ilic', 'M-108', null], // Geburtsdatum fehlt -> als U21 behandelt
];

async function ensureUser(email, patch) {
  // Aeltere Dummy-Daten hatten echte E-Mail-Kennungen. Ueber die eindeutige
  // Mitgliedsnummer finden und auf die datensparsame Login-Kennung migrieren.
  try {
    const u = await pb.collection('users').getFirstListItem(`mitgliedsnummer="${patch.mitgliedsnummer}"`);
    await pb.collection('users').update(u.id, { email, ...patch });
    return u;
  } catch { /* noch nicht ueber die Nummer vorhanden */ }
  try {
    const u = await pb.collection('users').getFirstListItem(`email="${email}"`);
    await pb.collection('users').update(u.id, patch);
    return u;
  } catch {
    return pb.collection('users').create({
      email,
      password: PW,
      passwordConfirm: PW,
      verified: true,
      ...patch,
    });
  }
}

const idVon = {};
for (const [email, name, nr, gb] of leute) {
  const u = await ensureUser(loginEmail(nr), {
    name,
    mitgliedsnummer: nr,
    rolle: 'mitglied',
    rollen: ['mitglied'],
    geburtsdatum: gb ? `${gb} 00:00:00.000Z` : null,
  });
  idVon[nr] = u.id;
  console.log('Mitglied:', nr, name, gb ?? '(ohne Geburtsdatum)');
}

// Passende Sorte fuer die Snapshot-Felder holen (falls seed-ausgabe lief).
async function sorteVon(name) {
  try {
    return await pb.collection('sorten').getFirstListItem(`name="${name}"`);
  } catch {
    return null;
  }
}
const nl = await sorteVon('Gushers'); // >10 % THC
const cbd = await sorteVon('CBD Aurora'); // <=10 % THC

// Etwas Tagesumsatz einspielen, damit die Statuskarten nicht bei 0 stehen.
// Nur anlegen, wenn fuer das Mitglied heute noch nichts gebucht ist (idempotent).
async function buchungHeute(nr, sorte, menge) {
  const mid = idVon[nr];
  if (!mid) return;
  const vorhanden = await pb.collection('ausgaben').getList(1, 1, {
    filter: `mitglied="${mid}" && tag="${tag}"`,
  });
  if (vorhanden.totalItems > 0) {
    console.log('Umsatz heute vorhanden, ueberspringe:', nr);
    return;
  }
  await pb.collection('ausgaben').create({
    mitglied: mid,
    mitgliedsnummer: nr,
    sorte: sorte?.id ?? null,
    sorte_name: sorte?.name ?? 'Demo-Sorte',
    charge: sorte?.charge ?? '',
    thc_prozent: sorte?.thc_prozent ?? 0,
    cbd_prozent: sorte?.cbd_prozent ?? 0,
    menge_gramm: menge,
    beitrag_euro: beitragEuro(menge),
    tag,
    monat,
    belegnr: `SEED-${nr}-${tag.replaceAll('-', '')}`,
    notiz: 'Dummy-Tagesumsatz (Seed).',
  });
  console.log('Tagesumsatz gebucht:', nr, menge, 'g');
}

// Anna schon nah am Tageslimit; Falk moderat; Clara (U21) mit CBD-Sorte.
await buchungHeute('M-101', nl, 22); // nur noch 3 g heute moeglich
await buchungHeute('M-106', nl, 8);
if (cbd) await buchungHeute('M-103', cbd, 6); // U21 mit zulaessiger Sorte

console.log(`\nFertig. ${leute.length} Dummy-Mitglieder, Passwort: ${PW}`);
