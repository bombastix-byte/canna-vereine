import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Beitrag/Antwort löschen. Die PocketBase-deleteRule erlaubt das nur dem
// Verfasser oder dem Vorstand (Antworten kaskadieren mit).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatBrett = __fn ? __fn.brett !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb } = ergebnis;
  if (!hatBrett) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const id = String(daten.get('beitrag') ?? '').trim();
  if (id) {
    try {
      await pb.collection('brett_beitraege').delete(id);
    } catch {
      return redirect('/mitglieder/brett?fehler=1', 303);
    }
  }
  return redirect('/mitglieder/brett?ok=geloescht', 303);
};
