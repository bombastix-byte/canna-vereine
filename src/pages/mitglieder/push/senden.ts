import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { pushKonfiguriert } from '../../../lib/push';
import { pushAnAlle } from '../../../lib/push-broadcast';

// Sendet eine Push-Nachricht an alle Mitglieder mit Abo. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  if (!pushKonfiguriert()) return redirect('/mitglieder/nachricht?fehler=push_aus', 303);

  const daten = await request.formData();
  const titel = String(daten.get('titel') ?? '').trim();
  const text = String(daten.get('text') ?? '').trim();
  if (!titel) return redirect('/mitglieder/nachricht?fehler=fehlend', 303);

  const r = await pushAnAlle(pb, { titel, text, url: '/mitglieder/bereich' });
  return redirect(`/mitglieder/nachricht?ok=1&n=${r.gesendet}`, 303);
};
