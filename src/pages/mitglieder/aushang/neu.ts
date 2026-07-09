import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';
import { berlinTag } from '../../../lib/ausgabe';

// Neuen Aushang veröffentlichen (Vorstand). Erscheint sofort (SSR liest live).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatAushang = __fn ? __fn.aushang !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatAushang) return redirect('/mitglieder/bereich', 303);
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const titel = String(daten.get('titel') ?? '').trim().slice(0, 200);
  const inhalt = String(daten.get('inhalt') ?? '').trim().slice(0, 5000);
  if (!titel || !inhalt) return redirect('/mitglieder/aushang', 303);

  try {
    const rec = await pb.collection('mitteilungen').create({ titel, inhalt, datum: berlinTag() });
    await protokolliere(pb, mitglied, 'aushang.angelegt', { objektTyp: 'aushang', objektId: rec.id, objektLabel: titel });
  } catch {
    return redirect('/mitglieder/aushang', 303);
  }
  return redirect('/mitglieder/aushang?ok=1', 303);
};
