// E2E: PWA (Manifest, Service Worker, Offline) + Push (VAPID-Key, Abo an/ab,
// Vorstand-Broadcast, Rollen-Gate). Push-Zustellung an echte Geraete laesst
// sich ohne Browser nicht testen - hier die komplette Server-Plumbing.
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const STAFF = process.env.PB_STAFF_EMAIL ?? 'ausgabe@example.local';
const STAFF_PW = process.env.PB_STAFF_PW ?? 'change-me-staff';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, ist, soll) { const ok = ist === soll; if (!ok) fehler++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (ist=${ist}, soll=${soll})`}`); }
function pruefeWahr(name, bed, info) { if (!bed) fehler++; console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`); }
const anmelden = async (email, pw) => {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, passwort: pw }) });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
};
const jsonPost = (pfad, obj, cookie) => fetch(`${BASE}${pfad}`, { method: 'POST', headers: { origin: BASE, 'content-type': 'application/json', cookie }, body: JSON.stringify(obj) });

// --- PWA-Basics ---
const man = await fetch(`${BASE}/manifest.webmanifest`);
const manJson = await man.json().catch(() => ({}));
pruefe('Manifest -> 200', man.status, 200);
pruefeWahr('Manifest hat Namen + Icons + standalone', !!manJson.name && Array.isArray(manJson.icons) && manJson.icons.length >= 2 && manJson.display === 'standalone');
const sw = await fetch(`${BASE}/sw.js`);
pruefe('Service Worker -> 200', sw.status, 200);
pruefeWahr('SW enthaelt push-Handler', (await sw.text()).includes("addEventListener('push'"));
pruefe('Offline-Seite -> 200', (await fetch(`${BASE}/offline`)).status, 200);
pruefeWahr('Icon 192 vorhanden', (await fetch(`${BASE}/icon-192.png`)).status === 200);

// --- VAPID-Key ---
const vapid = await (await fetch(`${BASE}/mitglieder/push/vapid`)).json();
const hatVapid = !!process.env.VAPID_PUBLIC;
pruefe('VAPID-Endpoint spiegelt Konfiguration', vapid.konfiguriert, hatVapid);
if (hatVapid) pruefeWahr('VAPID-Public-Key geliefert', typeof vapid.key === 'string' && vapid.key.length > 50);

// --- Abo an/ab (als Mitglied) ---
const eva = await anmelden('eva@dummy.local', DUMMY_PW);
const evaUser = await pb.collection('users').getFirstListItem('mitgliedsnummer="M-105"');
for (const a of await pb.collection('push_abos').getFullList({ filter: `mitglied="${evaUser.id}"` })) await pb.collection('push_abos').delete(a.id);
const sub = { endpoint: 'https://push.example.com/fake-eva-1', keys: { p256dh: 'testp256', auth: 'testauth' } };
pruefe('Abo anmelden -> ok', (await jsonPost('/mitglieder/push/anmelden', sub, eva)).status, 200);
let abos = await pb.collection('push_abos').getFullList({ filter: `mitglied="${evaUser.id}"` });
pruefe('Ein Abo gespeichert', abos.length, 1);
pruefe('Abo hat Mitglied + Keys', abos[0].endpoint === sub.endpoint && abos[0].p256dh === 'testp256', true);
// erneut mit gleichem Endpoint -> weiterhin genau eins (idempotent)
await jsonPost('/mitglieder/push/anmelden', sub, eva);
pruefe('Erneutes Anmelden -> weiterhin 1 Abo', (await pb.collection('push_abos').getFullList({ filter: `endpoint="${sub.endpoint}"` })).length, 1);

// --- Vorstand: Nachricht senden ---
const vorstand = await anmelden(STAFF, STAFF_PW);
pruefe('Nachricht-Seite -> 200', (await fetch(`${BASE}/mitglieder/nachricht`, { headers: { origin: BASE, cookie: vorstand } })).status, 200);
const sendeR = await fetch(`${BASE}/mitglieder/push/senden`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie: vorstand }, body: new URLSearchParams({ titel: 'E2E-Test', text: 'hallo' }) });
const sendeLoc = sendeR.headers.get('location') ?? '';
// Mit VAPID: Versand an Fake-Endpoint schlaegt fehl -> ok=1&n=0. Ohne VAPID: push_aus.
pruefeWahr('Senden reagiert sauber', hatVapid ? sendeLoc.includes('ok=1') : sendeLoc.includes('push_aus'), sendeLoc);

// --- Rollen-Gate ---
pruefe('Nachricht-Seite als Mitglied -> 303', (await fetch(`${BASE}/mitglieder/nachricht`, { headers: { origin: BASE, cookie: eva }, redirect: 'manual' })).status, 303);
const evaSenden = await fetch(`${BASE}/mitglieder/push/senden`, { method: 'POST', redirect: 'manual', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded', cookie: eva }, body: new URLSearchParams({ titel: 'x' }) });
pruefeWahr('Senden als Mitglied -> keinzugriff', (evaSenden.headers.get('location') ?? '').includes('keinzugriff'));

// --- Abo abmelden ---
pruefe('Abo abmelden -> ok', (await jsonPost('/mitglieder/push/abmelden', { endpoint: sub.endpoint }, eva)).status, 200);
pruefe('Abo entfernt', (await pb.collection('push_abos').getFullList({ filter: `endpoint="${sub.endpoint}"` })).length, 0);

console.log(`\n${fehler === 0 ? 'HTTP-E2E PWA/PUSH BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
