import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { bucheAufnahmebeitrag } from '../../../lib/kasse-buchung';

// Aufnahmebeitrag über die Kasse kassieren (Schnellaktion). Optional einem
// Mitglied per Mitgliedsnummer zugeordnet. Nur Ausgabe/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const betrag = Number(String(daten.get('betrag_euro') ?? '').replace(',', '.'));
  const nummer = String(daten.get('mitgliedsnummer') ?? '').trim();
  if (!(betrag > 0)) return redirect('/mitglieder/kasse?fehler=betrag', 303);

  // Optionale Zuordnung über die Mitgliedsnummer.
  let mitgliedId: string | undefined;
  if (nummer) {
    try {
      const u = await pb.collection('users').getFirstListItem(`mitgliedsnummer="${nummer}"`);
      mitgliedId = u.id;
    } catch {
      mitgliedId = undefined;
    }
  }

  const ok = await bucheAufnahmebeitrag(pb, betrag, mitgliedId, mitglied.id);
  return redirect(`/mitglieder/kasse?${ok ? 'ok=aufnahme' : 'fehler=fehlgeschlagen'}`, 303);
};
