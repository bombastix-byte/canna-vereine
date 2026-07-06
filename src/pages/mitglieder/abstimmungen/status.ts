import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

import { darfVerwalten } from '../../../lib/rollen';

// Oeffnet oder schliesst eine Abstimmung. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatAbstimmungen = __fn ? __fn.abstimmungen !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatAbstimmungen) return redirect('/mitglieder/bereich', 303);
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('abstimmung') ?? '').trim();
  const status = String(daten.get('status') ?? '').trim();
  if (!id || (status !== 'offen' && status !== 'geschlossen')) {
    return redirect('/mitglieder/abstimmungen?fehler=fehlgeschlagen', 303);
  }

  try {
    await pb.collection('abstimmungen').update(id, { status });
  } catch {
    return redirect('/mitglieder/abstimmungen?fehler=fehlgeschlagen', 303);
  }
  return redirect(`/mitglieder/abstimmungen?ok=status#a-${id}`, 303);
};
