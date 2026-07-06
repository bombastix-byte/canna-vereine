import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

import { darfVerwalten } from '../../../lib/rollen';

// Termin löschen (samt Zusagen per cascadeDelete). Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatTermine = __fn ? __fn.termine !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatTermine) return redirect('/mitglieder/bereich', 303);
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('termin') ?? '').trim();
  if (!id) return redirect('/mitglieder/termine', 303);
  try {
    await pb.collection('termine').delete(id);
  } catch {
    return redirect('/mitglieder/termine?fehler=1', 303);
  }
  return redirect('/mitglieder/termine?ok=geloescht', 303);
};
