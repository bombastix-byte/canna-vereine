import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { hatTermine } from '../../../lib/funktionen';
import { darfVerwalten } from '../../../lib/rollen';

// Neuen Termin anlegen. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatTermine) return redirect('/mitglieder/bereich', 303);
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const titel = String(daten.get('titel') ?? '').trim();
  const datum = String(daten.get('datum') ?? '').trim();
  const ort = String(daten.get('ort') ?? '').trim();
  const beschreibung = String(daten.get('beschreibung') ?? '').trim();
  if (!titel || !datum) return redirect('/mitglieder/termine?fehler=eingabe', 303);

  try {
    await pb.collection('termine').create({
      titel,
      datum: `${datum} 00:00:00.000Z`,
      ort,
      beschreibung,
    });
  } catch {
    return redirect('/mitglieder/termine?fehler=1', 303);
  }
  return redirect('/mitglieder/termine?ok=neu', 303);
};
