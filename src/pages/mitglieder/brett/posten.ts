import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Beitrag oder Antwort am Schwarzen Brett veröffentlichen.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatBrett = __fn ? __fn.brett !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatBrett) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const text = String(daten.get('text') ?? '').trim().slice(0, 2000);
  const antwortAuf = String(daten.get('antwort_auf') ?? '').trim();
  if (!text) return redirect('/mitglieder/brett?fehler=1', 303);

  // Antworten nur eine Ebene tief: zeigt das Ziel selbst auf einen Beitrag,
  // wird an dessen Wurzel gehängt.
  let ziel = antwortAuf;
  if (ziel) {
    try {
      const elter = await pb.collection('brett_beitraege').getOne(ziel);
      if (elter.antwort_auf) ziel = elter.antwort_auf as string;
    } catch {
      ziel = '';
    }
  }

  try {
    await pb.collection('brett_beitraege').create({
      mitglied: mitglied.id,
      text,
      antwort_auf: ziel || null,
    });
  } catch {
    return redirect('/mitglieder/brett?fehler=1', 303);
  }
  return redirect(`/mitglieder/brett?ok=1${ziel ? `#b-${ziel}` : ''}`, 303);
};
