import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../lib/pb';
import { darfAnbau } from '../../../../lib/rollen';

// Legt einen Anbau-Plan an oder aktualisiert Name/Beschreibung/Aktiv.
// Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('id') ?? '').trim();
  const name = String(daten.get('name') ?? '').trim();
  const beschreibung = String(daten.get('beschreibung') ?? '').trim();
  const aktiv = daten.get('aktiv') != null;

  if (!name) return redirect('/mitglieder/anbau/plaene?fehler=fehlend', 303);

  let plan;
  try {
    plan = id
      ? await pb.collection('anbau_plaene').update(id, { name, beschreibung, aktiv })
      : await pb.collection('anbau_plaene').create({ name, beschreibung, aktiv: true });
  } catch {
    return redirect('/mitglieder/anbau/plaene?fehler=fehlgeschlagen', 303);
  }

  return redirect(`/mitglieder/anbau/plaene?ok=plan#p-${plan.id}`, 303);
};
