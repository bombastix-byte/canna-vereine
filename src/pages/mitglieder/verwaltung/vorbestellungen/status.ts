import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../lib/pb';
import { darfVerwalten } from '../../../../lib/rollen';

// Status einer Vorbestellung setzen (Vorstand): bestaetigt / abgeholt / storniert.
export const prerender = false;

const ERLAUBT = ['offen', 'bestaetigt', 'abgeholt', 'storniert'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('id') ?? '').trim();
  const status = String(daten.get('status') ?? '').trim();
  if (id && ERLAUBT.includes(status)) {
    try {
      await pb.collection('vorbestellungen').update(id, { status });
    } catch {
      /* egal */
    }
  }
  return redirect('/mitglieder/verwaltung/vorbestellungen?ok=1', 303);
};
