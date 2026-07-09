import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Sortenbewertung durch ein Mitglied: 1-5 Sterne + optionaler Kurzkommentar.
// Eine Bewertung je Mitglied und Sorte (Upsert). Jedes Mitglied darf bewerten.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatBewertungen = __fn ? __fn.bewertungen !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatBewertungen) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const sorte = String(daten.get('sorte') ?? '').trim();
  const sterne = Math.round(Number(daten.get('sterne')));
  const kommentar = String(daten.get('kommentar') ?? '').trim().slice(0, 500);
  if (!sorte || !(sterne >= 1 && sterne <= 5)) {
    return redirect('/mitglieder/sortenberichte?fehler=bewertung', 303);
  }

  try {
    // Vorhandene Bewertung dieses Mitglieds für die Sorte -> aktualisieren.
    const vorhanden = await pb
      .collection('sorten_bewertungen')
      .getFirstListItem(`sorte="${sorte}" && mitglied="${mitglied.id}"`);
    await pb.collection('sorten_bewertungen').update(vorhanden.id, { sterne, kommentar });
  } catch {
    try {
      await pb.collection('sorten_bewertungen').create({ sorte, mitglied: mitglied.id, sterne, kommentar });
    } catch {
      return redirect('/mitglieder/sortenberichte?fehler=bewertung', 303);
    }
  }

  return redirect(`/mitglieder/sortenberichte?ok=bewertet#s-${sorte}`, 303);
};
