import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

import { darfVerwalten } from '../../../lib/rollen';
import { sendeMail, mailKonfiguriert } from '../../../lib/mail';
import { mailTest } from '../../../lib/mail-vorlagen';
import { site } from '../../../config';

// Sendet eine Testmail an das Vereinspostfach (Kontaktadresse), damit der
// Vorstand die SMTP-Einrichtung pruefen kann. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatAntraege = __fn ? __fn.antraege !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { mitglied } = ergebnis;
  if (!hatAntraege) return redirect('/mitglieder/bereich', 303);
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  if (!mailKonfiguriert()) return redirect('/mitglieder/antraege?ok=testmail_aus', 303);

  const v = mailTest({ vereinsname: site.vereinsname, email: site.kontakt.email, ort: site.kontakt.ort });
  const r = await sendeMail({ an: site.kontakt.email, betreff: v.betreff, text: v.text });
  return redirect(`/mitglieder/antraege?ok=${r.ok ? 'testmail' : 'testmail_aus'}`, 303);
};
