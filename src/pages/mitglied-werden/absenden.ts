import type { APIRoute } from 'astro';
import { neuePb } from '../../lib/pb';
import { alterAmTag, berlinTag } from '../../lib/ausgabe';

// Nimmt einen oeffentlichen Beitrittsantrag entgegen und legt ihn als
// "offen" in der Antragsliste des Vorstands ab. Honeypot + Mindestalter 18.
export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const daten = await request.formData();

  // Honeypot: fuellt nur ein Bot aus -> kommentarlos "ok" anzeigen.
  if (String(daten.get('website') ?? '').trim() !== '') {
    return redirect('/mitglied-werden?ok=1', 303);
  }

  const name = String(daten.get('name') ?? '').trim();
  const email = String(daten.get('email') ?? '').trim();
  const geburtsdatum = String(daten.get('geburtsdatum') ?? '').trim();
  const telefon = String(daten.get('telefon') ?? '').trim();
  const nachricht = String(daten.get('nachricht') ?? '').trim().slice(0, 2000);

  if (!name || !email || !geburtsdatum) {
    return redirect('/mitglied-werden?fehler=fehlend', 303);
  }
  const alter = alterAmTag(geburtsdatum, berlinTag());
  if (alter === null || alter < 18) {
    return redirect('/mitglied-werden?fehler=alter', 303);
  }

  try {
    await neuePb().collection('antraege').create({
      name,
      email,
      telefon,
      geburtsdatum,
      nachricht,
      status: 'offen',
      notiz: '',
    });
  } catch {
    return redirect('/mitglied-werden?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglied-werden?ok=1', 303);
};
