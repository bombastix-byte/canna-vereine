import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { totpPruefen } from '../../../lib/totp';

// Aktiviert die Zwei-Faktor-Anmeldung: das Geheimnis wird erst gespeichert,
// wenn der erste Code aus der App korrekt war (beweist, dass die App
// eingerichtet ist - sonst sperrt man sich selbst aus).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const secret = String(daten.get('secret') ?? '').trim();
  const code = String(daten.get('code') ?? '').trim();
  if (!secret || !code) return redirect('/mitglieder/sicherheit?fehler=fehlgeschlagen', 303);

  const schritt = totpPruefen(secret, code);
  if (schritt === null) return redirect('/mitglieder/sicherheit?fehler=code', 303);

  try {
    let zf;
    try {
      zf = await pb.collection('zweifaktor').getFirstListItem(`user="${mitglied.id}"`);
    } catch {
      zf = null;
    }
    if (zf) {
      await pb.collection('zweifaktor').update(zf.id, { secret, aktiv: true, letzter_schritt: schritt });
    } else {
      await pb.collection('zweifaktor').create({ user: mitglied.id, secret, aktiv: true, letzter_schritt: schritt });
    }
  } catch {
    return redirect('/mitglieder/sicherheit?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/sicherheit?ok=an', 303);
};
