import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { totpPruefen } from '../../../lib/totp';

// Deaktiviert die Zwei-Faktor-Anmeldung - nur mit gueltigem aktuellen Code
// (verhindert, dass jemand mit offener Sitzung den Schutz still entfernt).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const code = String(daten.get('code') ?? '').trim();

  let zf;
  try {
    zf = await pb.collection('zweifaktor').getFirstListItem(`user="${mitglied.id}" && aktiv=true`);
  } catch {
    return redirect('/mitglieder/sicherheit', 303);
  }

  if (totpPruefen(zf.secret, code) === null) {
    return redirect('/mitglieder/sicherheit?fehler=code', 303);
  }

  try {
    await pb.collection('zweifaktor').update(zf.id, { aktiv: false });
  } catch {
    return redirect('/mitglieder/sicherheit?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/sicherheit?ok=aus', 303);
};
