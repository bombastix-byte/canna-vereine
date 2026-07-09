import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten, ROLLEN } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';
import { bucheAufnahmebeitrag } from '../../../lib/kasse-buchung';
import { site } from '../../../config';
import { syntheticEmail } from '../../../lib/login';

// Legt ein Mitglied manuell an (Vorstand). Naechste freie M-Nummer, wenn keine
// angegeben; Startpasswort automatisch, wenn keins gesetzt. Zeigt das Passwort
// danach zum Weitergeben.
export const prerender = false;

function startpasswort(): string {
  const teil = () => Math.random().toString(36).slice(2, 6);
  return `Start-${teil()}-${teil()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatAufnahmebeitrag = (__fn?.aufnahmebeitragEuro ?? 0) > 0;
  const aufnahmebeitragEuro = __fn?.aufnahmebeitragEuro ?? 0;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  // Datensparsamer Modus: keine personenbezogenen Daten (Name/E-Mail/Geburts-
  // datum). Login läuft über die Mitgliedsnummer, intern via synthetischer Kennung.
  const privacy = site.login_modus === 'mitgliedsnummer';

  const daten = await request.formData();
  const vorname = privacy ? '' : String(daten.get('vorname') ?? '').trim();
  const nachname = privacy ? '' : String(daten.get('nachname') ?? '').trim();
  let mitgliedsnummer = String(daten.get('mitgliedsnummer') ?? '').trim();
  const geburtsdatum = privacy ? '' : String(daten.get('geburtsdatum') ?? '').trim();
  const rollen = daten.getAll('rollen').map((r) => String(r)).filter((r) => (ROLLEN as string[]).includes(r));
  const passwort = String(daten.get('passwort') ?? '').trim() || startpasswort();

  const fehler = (code: string) => redirect(`/mitglieder/verwaltung?fehler=${code}`, 303);
  if (!privacy && (!nachname && !vorname)) return fehler('name');

  // Freie M-Nummer, wenn keine angegeben (im Privacy-Modus die einzige Kennung).
  if (!mitgliedsnummer) {
    let nr = 1;
    try {
      for (const u of await pb.collection('users').getFullList({ fields: 'mitgliedsnummer' })) {
        const m = /^M-(\d+)$/.exec(String(u.mitgliedsnummer ?? ''));
        if (m) nr = Math.max(nr, Number(m[1]) + 1);
      }
    } catch {
      /* Startwert */
    }
    mitgliedsnummer = 'M-' + String(nr).padStart(3, '0');
  }

  // Identität: synthetisch (Privacy) oder echte E-Mail (Standard-Modus).
  const email = privacy
    ? syntheticEmail(mitgliedsnummer)
    : String(daten.get('email') ?? '').trim().toLowerCase();
  if (!privacy && (!email || !email.includes('@'))) return fehler('email');

  // Kennung schon vergeben?
  try {
    await pb.collection('users').getFirstListItem(`email="${email}"`);
    return fehler('existiert');
  } catch {
    /* frei */
  }

  const name = [vorname, nachname].filter(Boolean).join(' ');
  let neu;
  try {
    neu = await pb.collection('users').create({
      email,
      password: passwort,
      passwordConfirm: passwort,
      name,
      vorname,
      nachname,
      mitgliedsnummer,
      geburtsdatum: geburtsdatum ? `${geburtsdatum} 00:00:00.000Z` : null,
      rollen: rollen.length ? rollen : ['mitglied'],
    });
  } catch {
    return fehler('fehlgeschlagen');
  }

  await protokolliere(pb, mitglied, 'mitglied.angelegt', {
    objektTyp: 'mitglied', objektId: neu.id, objektLabel: `${mitgliedsnummer} ${name}`.trim(),
    details: `Rollen: ${(rollen.length ? rollen : ['mitglied']).join(', ')}`,
  });

  // Aufnahmebeitrag (falls konfiguriert und bar kassiert) in die Kasse buchen.
  if (hatAufnahmebeitrag && daten.get('aufnahme_kassiert')) {
    await bucheAufnahmebeitrag(pb, aufnahmebeitragEuro, neu.id, mitglied.id, {
      kasseIntern: __fn ? __fn.kasse !== false : true,
      kasseExtern: locals.kasseExtern,
    });
  }

  const q = new URLSearchParams({ neu: '1', pw: passwort });
  return redirect(`/mitglieder/verwaltung/${neu.id}?${q.toString()}`, 303);
};
