import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

import { darfAusgeben } from '../../../lib/rollen';
import { bucheAufnahmebeitrag } from '../../../lib/kasse-buchung';

// Aufnahmebeitrag über die Kasse kassieren (Schnellaktion). Optional einem
// Mitglied per Mitgliedsnummer zugeordnet. Nur Ausgabe/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatKasse = __fn ? __fn.kasse !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatKasse) return redirect('/mitglieder/bereich', 303);
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

  const ok = await bucheAufnahmebeitrag(pb, betrag, mitgliedId, mitglied.id, { kasseIntern: hatKasse, kasseExtern: locals.kasseExtern });
  return redirect(`/mitglieder/kasse?${ok ? 'ok=aufnahme' : 'fehler=fehlgeschlagen'}`, 303);
};
