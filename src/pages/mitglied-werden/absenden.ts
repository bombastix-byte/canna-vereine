import type { APIRoute } from 'astro';
import { neuePb } from '../../lib/pb';
import { alterAmTag, berlinTag } from '../../lib/ausgabe';
import { sendeMail } from '../../lib/mail';
import { mailAntragEingang } from '../../lib/mail-vorlagen';
import { site } from '../../config';

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

  // Eingangsbestaetigung (falls SMTP konfiguriert; Fehler schlucken).
  const v = mailAntragEingang({ vereinsname: site.vereinsname, email: site.kontakt.email, ort: site.kontakt.ort }, name);
  await sendeMail({ an: email, betreff: v.betreff, text: v.text });

  return redirect('/mitglied-werden?ok=1', 303);
};
