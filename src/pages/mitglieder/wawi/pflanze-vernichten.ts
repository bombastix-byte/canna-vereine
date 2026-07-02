import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';

// Vernichtet eine EINZELNE Pflanze vor der Ernte (Schaedling, Maenchen, ...).
// Dokumentationspflichtig: legt einen Vernichtungssatz an (Stueck statt Gramm)
// und setzt die Pflanze auf "vernichtet". Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const pflanzeId = String(daten.get('pflanze') ?? '').trim();
  const grund = String(daten.get('grund') ?? '').trim();
  if (!pflanzeId) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  let pflanze;
  let charge;
  try {
    pflanze = await pb.collection('pflanzen').getOne(pflanzeId);
    charge = await pb.collection('chargen').getOne(pflanze.charge_ref);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }
  const zurueck = (q: string) => redirect(`/mitglieder/wawi?${q}#c-${charge.id}`, 303);
  if (pflanze.status !== 'wachsend') return zurueck('fehler=status');

  try {
    await pb.collection('vernichtungen').create({
      charge_ref: charge.id,
      charge_nr: charge.charge_nr || '',
      sorte_name: charge.sorte_name || '',
      anzahl_pflanzen: 1,
      pflanzen_nrn: pflanze.nummer,
      grund: grund || 'Pflanze vernichtet',
      datum: berlinTag(),
      durchgefuehrt_von: mitglied.id,
      zeuge: '',
      notiz: '',
    });
    await pb.collection('pflanzen').update(pflanzeId, { status: 'vernichtet' });
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  return zurueck('ok=vernichtet');
};
