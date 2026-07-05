import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { euro } from '../../../lib/kasse';

// Bar-Bewegung erfassen (Einlage z. B. Wechselgeld, Entnahme z. B. Einkauf).
// Nur Ausgabe/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const typ = String(daten.get('typ') ?? '').trim();
  const betrag = euro(Number(String(daten.get('betrag_euro') ?? '').replace(',', '.')));
  const zweck = String(daten.get('zweck') ?? '').trim();

  if (typ !== 'einlage' && typ !== 'entnahme') return redirect('/mitglieder/kasse?fehler=typ', 303);
  if (!(betrag > 0)) return redirect('/mitglieder/kasse?fehler=betrag', 303);

  try {
    await pb.collection('kassenbewegung').create({
      datum: berlinTag(),
      typ,
      betrag_euro: betrag,
      zweck,
      von: mitglied.id,
    });
  } catch {
    return redirect('/mitglieder/kasse?fehler=fehlgeschlagen', 303);
  }
  return redirect('/mitglieder/kasse?ok=bewegung', 303);
};
