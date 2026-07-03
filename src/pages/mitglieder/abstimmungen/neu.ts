import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { pushAnAlle } from '../../../lib/push-broadcast';

// Legt eine neue Abstimmung an. Nur Vorstand. Optionen: eine je Zeile.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const titel = String(daten.get('titel') ?? '').trim();
  const beschreibung = String(daten.get('beschreibung') ?? '').trim();
  const ende = String(daten.get('ende') ?? '').trim();
  const optionen = String(daten.get('optionen') ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!titel || optionen.length < 2) return redirect('/mitglieder/abstimmungen?fehler=optionen', 303);

  try {
    await pb.collection('abstimmungen').create({
      titel,
      beschreibung,
      optionen,
      status: 'offen',
      ende: ende ? `${ende} 00:00:00.000Z` : null,
    });
  } catch {
    return redirect('/mitglieder/abstimmungen?fehler=fehlgeschlagen', 303);
  }

  // Mitglieder mit Push-Abo benachrichtigen (falls konfiguriert).
  await pushAnAlle(pb, { titel: 'Neue Abstimmung', text: titel, url: '/mitglieder/abstimmungen' });

  return redirect('/mitglieder/abstimmungen?ok=neu', 303);
};
