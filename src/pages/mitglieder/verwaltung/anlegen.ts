import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten, ROLLEN } from '../../../lib/rollen';

// Legt ein Mitglied manuell an (Vorstand). Naechste freie M-Nummer, wenn keine
// angegeben; Startpasswort automatisch, wenn keins gesetzt. Zeigt das Passwort
// danach zum Weitergeben.
export const prerender = false;

function startpasswort(): string {
  const teil = () => Math.random().toString(36).slice(2, 6);
  return `Start-${teil()}-${teil()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const vorname = String(daten.get('vorname') ?? '').trim();
  const nachname = String(daten.get('nachname') ?? '').trim();
  const email = String(daten.get('email') ?? '').trim().toLowerCase();
  let mitgliedsnummer = String(daten.get('mitgliedsnummer') ?? '').trim();
  const geburtsdatum = String(daten.get('geburtsdatum') ?? '').trim();
  const rollen = daten.getAll('rollen').map((r) => String(r)).filter((r) => (ROLLEN as string[]).includes(r));
  const passwort = String(daten.get('passwort') ?? '').trim() || startpasswort();

  const fehler = (code: string) => redirect(`/mitglieder/verwaltung?fehler=${code}`, 303);
  if (!email || !email.includes('@')) return fehler('email');
  if (!nachname && !vorname) return fehler('name');

  // E-Mail schon vergeben?
  try {
    await pb.collection('users').getFirstListItem(`email="${email}"`);
    return fehler('existiert');
  } catch {
    /* frei */
  }

  // Freie M-Nummer, wenn keine angegeben.
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

  const q = new URLSearchParams({ neu: '1', pw: passwort });
  return redirect(`/mitglieder/verwaltung/${neu.id}?${q.toString()}`, 303);
};
