import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// RSVP: das angemeldete Mitglied sagt zu / vielleicht / ab. Eine Zeile je
// Mitglied und Termin (Upsert). Jedes Mitglied darf antworten.
export const prerender = false;

const ANTWORTEN = ['zu', 'vielleicht', 'ab'];

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatTermine = __fn ? __fn.termine !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatTermine) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const termin = String(daten.get('termin') ?? '').trim();
  const antwort = String(daten.get('antwort') ?? '').trim();
  if (!termin || !ANTWORTEN.includes(antwort)) {
    return redirect('/mitglieder/termine?fehler=1', 303);
  }

  try {
    // Vorhandene Antwort dieses Mitglieds für den Termin suchen -> aktualisieren.
    const vorhanden = await pb
      .collection('termin_zusagen')
      .getFirstListItem(`termin="${termin}" && mitglied="${mitglied.id}"`);
    await pb.collection('termin_zusagen').update(vorhanden.id, { antwort });
  } catch {
    // Keine vorhandene Antwort -> neu anlegen.
    try {
      await pb.collection('termin_zusagen').create({ termin, mitglied: mitglied.id, antwort });
    } catch {
      return redirect('/mitglieder/termine?fehler=1', 303);
    }
  }

  return redirect(`/mitglieder/termine?ok=1#t-${termin}`, 303);
};
