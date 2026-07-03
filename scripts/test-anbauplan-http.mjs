// E2E des Grow-Cockpits: Charge mit Plan + Anbaubeginn vor 24 Tagen (= Tag 25,
// Topping-Tag) -> "Anbau heute" zeigt Zyklustag, Phase und faellige Aufgaben;
// Erledigen quittiert dokumentiert (idempotent); Wawi zeigt das Tag-Abzeichen.
import PocketBase from 'pocketbase';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4321';
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@goerlitz.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';
const ANBAU = process.env.PB_ANBAU_EMAIL ?? 'anbau@example.local';
const ANBAU_PW = process.env.PB_ANBAU_PW ?? 'change-me-anbau';
const DUMMY_PW = process.env.PB_DUMMY_PW ?? 'DummyDemo2026!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, bed, info) {
  if (!bed) fehler++;
  console.log(`${bed ? 'PASS' : 'FAIL'}  ${name}${bed ? '' : `  ${info ?? ''}`}`);
}
const anmelden = async (email, pw) => {
  const r = await fetch(`${BASE}/mitglieder/anmelden`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, passwort: pw }),
  });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pb_token='));
};
const post = (pfad, felder, cookie) =>
  fetch(`${BASE}${pfad}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams(felder),
  });

// Aufraeumen + Testcharge anlegen: Anbaubeginn vor 24 Tagen -> heute Tag 25.
for (const c of await pb.collection('chargen').getFullList({ filter: 'herkunft="Cockpit-Test"' })) {
  await pb.collection('chargen').delete(c.id);
}
const start = new Date(Date.now() - 24 * 86400000).toISOString().slice(0, 10);
const plan = await pb.collection('anbau_plaene').getFirstListItem('aktiv=true');
const sorte = await pb.collection('sorten').getFirstListItem('name="Lemon Haze"');

const anbauCookie = await anmelden(ANBAU, ANBAU_PW);
await post('/mitglieder/wawi/charge-neu', {
  sorte: sorte.id, herkunft: 'Cockpit-Test', pflanzenzahl: '4', anbau_start: start, plan: plan.id,
}, anbauCookie);
const charge = await pb.collection('chargen').getFirstListItem('herkunft="Cockpit-Test"', { sort: '-created' });
pruefe('Charge mit Plan angelegt', charge.plan === plan.id);

// Cockpit-Seite
const html = await (await fetch(`${BASE}/mitglieder/anbau`, { headers: { cookie: anbauCookie } })).text();
pruefe('Anbau heute -> Tag 25 sichtbar', html.includes('Tag 25'));
pruefe('Phase Vegetation sichtbar', html.includes('Vegetation'));
pruefe('Topping heute faellig', html.includes('Topping'));
pruefe('Duengeschema mit Details sichtbar', html.includes('BioGrow'));
pruefe('Ueberfaellig-Kennzeichnung vorhanden', html.includes('überfällig'));
pruefe('Vorschau "Als Nächstes" vorhanden', html.includes('Als Nächstes'));

// Topping erledigen -> dokumentiert + verschwindet
const topping = await pb.collection('plan_schritte').getFirstListItem(`plan="${plan.id}" && titel~"Topping"`);
const loc = (await post('/mitglieder/anbau/erledigt', { charge: charge.id, schritt: topping.id, zyklustag: '25' }, anbauCookie)).headers.get('location') ?? '';
pruefe('Erledigt -> ok', loc.includes('ok=1'), loc);
const logs = await pb.collection('pflege_log').getFullList({ filter: `charge_ref="${charge.id}" && schritt="${topping.id}"` });
pruefe('Pflege-Log dokumentiert (Person + Tag)', logs.length === 1 && logs[0].zyklustag === 25 && !!logs[0].person);
// Doppelklick -> kein zweiter Eintrag
await post('/mitglieder/anbau/erledigt', { charge: charge.id, schritt: topping.id, zyklustag: '25' }, anbauCookie);
pruefe('Doppel-Quittung verhindert', (await pb.collection('pflege_log').getFullList({ filter: `charge_ref="${charge.id}" && schritt="${topping.id}"` })).length === 1);
const html2 = await (await fetch(`${BASE}/mitglieder/anbau`, { headers: { cookie: anbauCookie } })).text();
pruefe('Topping nach Quittung nicht mehr faellig', !html2.includes('>Topping<') || !new RegExp('Topping[^<]*</span>[\\s\\S]{0,400}Erledigt').test(html2));

// Wawi-Badge + Rollen-Gate
const wawiHtml = await (await fetch(`${BASE}/mitglieder/wawi`, { headers: { cookie: anbauCookie } })).text();
pruefe('Wawi zeigt Tag-Abzeichen', wawiHtml.includes('Tag 25'));
const evaCookie = await anmelden('eva@dummy.local', DUMMY_PW);
const evaR = await fetch(`${BASE}/mitglieder/anbau`, { headers: { cookie: evaCookie }, redirect: 'manual' });
pruefe('Mitglied ohne Anbau-Rolle -> blockiert', evaR.status === 303, String(evaR.status));

console.log(`\n${fehler === 0 ? 'HTTP-E2E ANBAUPLAN BESTANDEN' : fehler + ' FEHLGESCHLAGEN'}`);
process.exit(fehler ? 1 : 0);
