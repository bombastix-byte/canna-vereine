import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';

// Aushang löschen (Vorstand).
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
  const id = String(daten.get('id') ?? '').trim();
  if (id) {
    try {
      let label = id;
      try { label = (await pb.collection('mitteilungen').getOne(id)).titel ?? id; } catch { /* egal */ }
      await pb.collection('mitteilungen').delete(id);
      await protokolliere(pb, mitglied, 'aushang.geloescht', { objektTyp: 'aushang', objektId: id, objektLabel: label });
    } catch {
      return redirect('/mitglieder/aushang', 303);
    }
  }
  return redirect('/mitglieder/aushang?ok=1', 303);
};
