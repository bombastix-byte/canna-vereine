import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';

// Entfernt ein Mitglied endgueltig (Vorstand). Das eigene Konto kann nicht
// geloescht werden (Aussperr-Schutz).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('mitglied') ?? '').trim();
  if (!id) return redirect('/mitglieder/verwaltung?fehler=fehlend', 303);
  if (id === mitglied.id) {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=selbst`, 303);
  }

  // Label vor dem Löschen sichern (für das Protokoll).
  let label = id;
  try {
    const u = await pb.collection('users').getOne(id);
    label = `${u.mitgliedsnummer || ''} ${[u.vorname, u.nachname].filter(Boolean).join(' ') || u.name || ''}`.trim() || id;
  } catch {
    /* egal */
  }

  try {
    await pb.collection('users').delete(id);
  } catch {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=loeschen`, 303);
  }

  await protokolliere(pb, mitglied, 'mitglied.geloescht', {
    objektTyp: 'mitglied', objektId: id, objektLabel: label,
  });

  return redirect('/mitglieder/verwaltung?geloescht=1', 303);
};
