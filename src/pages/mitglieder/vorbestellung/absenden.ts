import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Nimmt eine Vorbestellung entgegen. Schreibt als das angemeldete Mitglied,
// Status stets "offen". Aenderung/Stornierung uebernimmt der Vorstand im CMS.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatVorbestellung = __fn ? __fn.vorbestellung !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) {
    return redirect('/mitglieder?fehler=anmeldung', 303);
  }
  const { pb, mitglied } = ergebnis;
  if (!hatVorbestellung) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const sorte = String(daten.get('sorte') ?? '').trim();
  const mengeRoh = String(daten.get('menge_gramm') ?? '').trim();
  const abholdatum = String(daten.get('abholdatum') ?? '').trim();
  const hinweis = String(daten.get('hinweis') ?? '').trim();

  if (!sorte || !mengeRoh) {
    return redirect('/mitglieder/vorbestellung?fehler=fehlend', 303);
  }
  const menge = Number(mengeRoh);
  if (!Number.isFinite(menge) || menge <= 0) {
    return redirect('/mitglieder/vorbestellung?fehler=menge', 303);
  }

  try {
    await pb.collection('vorbestellungen').create({
      mitglied: mitglied.id,
      sorte,
      menge_gramm: menge,
      abholdatum: abholdatum || null,
      hinweis: hinweis || '',
      status: 'offen',
    });
  } catch {
    return redirect('/mitglieder/vorbestellung?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/vorbestellung?ok=1', 303);
};
