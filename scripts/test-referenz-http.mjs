// E2E des "Referenz-Pakets": kompletter Zwei-Faktor-Zyklus (einrichten ->
// Login mit Code-Schritt -> falscher Code -> richtiger Code -> deaktivieren)
// und Pflanzen-Ebene (auto-anlegen -> einzeln vernichten -> Ernte-Statuswechsel).
import PocketBase from 'pocketbase';
import { hotp, zeitschritt } from '../src/lib/totp.ts';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, bed, info) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`);
}
const cookieVon = (r, name) =>
  (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='));
const anmeldenRoh = (email, pw) =>
  fetch(`${BASE}/mitglieder/anmelden`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, passwort: pw }),
  });
const post = (pfad, felder, cookie) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams(felder),
  });

// Aufraeumen: 2FA-Reste von Eva
const eva = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-105"');
for (const z of await pb.collection('zweifaktor').getFullList({ filter: `user="${eva.id}"` })) {
  await pb.collection('zweifaktor').delete(z.id);
}

// ---------- 1. Zwei-Faktor einrichten ----------
let evaCookie = cookieVon(await anmeldenRoh(eva.email, DUMMY_PW), 'pb_token');
pruefe('Login ohne 2FA -> direkt Token', !!evaCookie);
const setupHtml = await (await fetch(`${BASE}/mitglieder/sicherheit`, { headers: { cookie: evaCookie } })).text();
const secret = /name="secret" value="([A-Z2-7]+)"/.exec(setupHtml)?.[1];
pruefe('Setup-Seite liefert Geheimnis + QR', !!secret && setupHtml.includes('<svg'));
const aktLoc = (await post('/mitglieder/sicherheit/aktivieren', { secret, code: hotp(secret, zeitschritt()) }, evaCookie)).headers.get('location') ?? '';
pruefe('Aktivieren mit App-Code -> ok', aktLoc.includes('ok=an'), aktLoc);

// Replay-Marker zuruecksetzen, damit der Login im selben 30s-Fenster testbar ist.
const zf = await pb.collection('zweifaktor').getFirstListItem(`user="${eva.id}"`);
await pb.collection('zweifaktor').update(zf.id, { letzter_schritt: zeitschritt() - 10 });

// ---------- 2. Login verlangt jetzt den Code ----------
const login2 = await anmeldenRoh(eva.email, DUMMY_PW);
const pending = cookieVon(login2, 'pb_pending');
pruefe('Login mit 2FA -> Code-Schritt (pending, kein Token)', (login2.headers.get('location') ?? '').includes('/mitglieder/code') && !!pending && !cookieVon(login2, 'pb_token'));
// Geschuetzte Seite mit nur-pending -> abgewiesen
const bereichOhne = await fetch(`${BASE}/mitglieder/bereich`, { headers: { cookie: pending }, redirect: 'manual' });
pruefe('Pending-Cookie reicht NICHT fuer den Bereich', bereichOhne.status === 303);
// Falscher Code
const falsch = (await post('/mitglieder/code/pruefen', { code: '000001' }, pending)).headers.get('location') ?? '';
pruefe('Falscher Code -> abgelehnt', falsch.includes('fehler=code'), falsch);
// Richtiger Code
const richtig = await post('/mitglieder/code/pruefen', { code: hotp(secret, zeitschritt()) }, pending);
const echterToken = cookieVon(richtig, 'pb_token');
pruefe('Richtiger Code -> Token', (richtig.headers.get('location') ?? '').includes('/mitglieder/bereich') && !!echterToken);
const bereichMit = await fetch(`${BASE}/mitglieder/bereich`, { headers: { cookie: echterToken }, redirect: 'manual' });
pruefe('Bereich mit Token -> 200', bereichMit.status === 200, String(bereichMit.status));
// Replay: derselbe Code nochmal (frisches pending)
const login3 = await anmeldenRoh(eva.email, DUMMY_PW);
const pending3 = cookieVon(login3, 'pb_pending');
const replay = (await post('/mitglieder/code/pruefen', { code: hotp(secret, zeitschritt()) }, pending3)).headers.get('location') ?? '';
pruefe('Replay: gleicher Code erneut -> abgelehnt', replay.includes('fehler=code'), replay);

// ---------- 3. Deaktivieren ----------
await pb.collection('zweifaktor').update(zf.id, { letzter_schritt: zeitschritt() - 10 });
const deakt = (await post('/mitglieder/sicherheit/deaktivieren', { code: hotp(secret, zeitschritt()) }, echterToken)).headers.get('location') ?? '';
pruefe('Deaktivieren mit Code -> ok', deakt.includes('ok=aus'), deakt);
const login4 = await anmeldenRoh(eva.email, DUMMY_PW);
pruefe('Nach Deaktivierung: Login wieder direkt', !!cookieVon(login4, 'pb_token'));
await pb.collection('zweifaktor').delete(zf.id);

// ---------- 4. Pflanzen-Ebene ----------
const anbauCookie = cookieVon(await anmeldenRoh(ANBAU, ANBAU_PW), 'pb_token');
const sorte = await pb.collection('sorten').getFirstListItem('name="CBD Aurora"');
await post('/mitglieder/wawi/charge-neu', { sorte: sorte.id, herkunft: 'Pflanzen-Test', pflanzenzahl: '3', anbau_start: '2026-07-01' }, anbauCookie);
const charge = await pb.collection('chargen').getFirstListItem('herkunft="Pflanzen-Test"', { sort: '-created' });
const pflanzen = await pb.collection('pflanzen').getFullList({ filter: `charge_ref="${charge.id}"`, sort: 'nummer' });
pruefe('Charge-Anlage erzeugt 3 Pflanzen (wachsend)', pflanzen.length === 3 && pflanzen.every((p) => p.status === 'wachsend'), String(pflanzen.length));
pruefe('Pflanzen-Nummern korrekt', pflanzen[0].nummer === `${charge.charge_nr}-P01`, pflanzen[0].nummer);
// Einzelne Pflanze vernichten
const pvLoc = (await post('/mitglieder/wawi/pflanze-vernichten', { pflanze: pflanzen[1].id, grund: 'Schädlingsbefall' }, anbauCookie)).headers.get('location') ?? '';
pruefe('Pflanze vernichten -> ok', pvLoc.includes('ok=vernichtet'), pvLoc);
pruefe('Pflanze auf vernichtet', (await pb.collection('pflanzen').getOne(pflanzen[1].id)).status === 'vernichtet');
const vern = await pb.collection('vernichtungen').getFirstListItem(`pflanzen_nrn="${pflanzen[1].nummer}"`);
pruefe('Vernichtungssatz stueckgenau (1 Pflanze, Nummer)', vern.anzahl_pflanzen === 1 && vern.grund === 'Schädlingsbefall');
// Ernte -> restliche Pflanzen geerntet
await post('/mitglieder/wawi/aktion', { charge: charge.id, aktion: 'ernte', frischgewicht_g: '500', ernte_datum: '2026-07-02' }, anbauCookie);
const nachErnte = await pb.collection('pflanzen').getFullList({ filter: `charge_ref="${charge.id}"` });
pruefe('Ernte: wachsende -> geerntet, vernichtete bleiben', nachErnte.filter((p) => p.status === 'geerntet').length === 2 && nachErnte.filter((p) => p.status === 'vernichtet').length === 1);

console.log(`\n${fehler === 0 ? 'HTTP-E2E REFERENZ BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
