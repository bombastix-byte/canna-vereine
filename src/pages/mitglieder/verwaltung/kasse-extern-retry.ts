import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { sendeVorgangErneut } from '../../../lib/kassen-konnektor';

// Erneuter Zustellversuch eines fehlgeschlagenen Kassenvorgangs. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('id') ?? '').trim();
  if (id) {
    try {
      const row = await pb.collection('kassenvorgaenge').getOne(id);
      await sendeVorgangErneut(pb, locals.kasseExtern, row);
    } catch {
      /* egal — Status bleibt fehler */
    }
  }
  return redirect('/mitglieder/verwaltung/kasse-extern?ok=1', 303);
};
